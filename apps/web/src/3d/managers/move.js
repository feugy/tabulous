// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/behaviors/movable').MoveBehavior} MoveBehavior
 * @typedef {import('@src/3d/managers/target').DropZone} DropZone
 * @typedef {import('@src/3d/utils').ScreenPosition} ScreenPosition
 */

import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { Observable } from '@babylonjs/core/Misc/observable.js'

import { makeLogger } from '../../utils/logger'
import { sleep } from '../../utils/time'
import { actionNames } from '../utils/actions'
import { animateMove } from '../utils/behaviors'
import { sortByElevation } from '../utils/gravity'
import { isAboveTable, screenToGround } from '../utils/vector'
import { controlManager } from './control'
import { selectionManager } from './selection'
import { targetManager } from './target'

const logger = makeLogger('move')

/**
 * @typedef {object} MoveDetails
 * @property {Mesh} mesh - moved mesh.
 */

/**
 * @typedef {object} PreMoveDetails
 * @property {Mesh[]} meshes - meshes that are about to be moved.
 */

class MoveManager {
  /**
   * Creates a manager to move meshes with MoveBehavior:
   * - can start, continue and stop moving managed mesh
   * - moves the entire selection if it contains the moved mesh
   * - triggers target detection while continuing the operation
   * - release mesh on table, or on their relevant target
   *
   * Prior to move operation, the onPreMoveObservable allows to add or remove meshes to the list.
   */
  constructor() {
    /** @type {number} elevation applied to meshes while dragging them. */
    this.elevation
    /** @type {boolean} true while a move operation is in progress. */
    this.inProgress = false
    /** @type {Observable<MoveDetails>} emits when moving a given mesh. */
    this.onMoveObservable = new Observable()
    /** @type {Observable<PreMoveDetails>} emits prior to starting the operation. */
    this.onPreMoveObservable = new Observable()
    /** @internal @type {Scene} main scene. */
    this.scene
    /** @internal @type {Set<string>} managed mesh ids. */
    this.meshIds = new Set()
    /** @internal @type {Map<string, MoveBehavior>} managed behaviors by their mesh id. */
    this.behaviorByMeshId = new Map()
    /** @internal @type {Set<Mesh>} set of meshes to re-select after moving them. */
    this.autoSelect = new Set()
  }

  /**
   * Gives a scene to the manager, and binds on input manager observables.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - scene attached to.
   * @param {number} [params.elevation=0.5] - elevation applied to meshes while dragging them.
   */
  init({ scene, elevation = 0.5 }) {
    this.scene = scene
    this.elevation = elevation
  }

  /**
   * Start moving a managed mesh, recording its position.
   * If it is part of the active selection, moves the entire selection.
   * Does nothing on unmanaged meshes or mesh with disabled behavior.
   * @param {Mesh} mesh - to be moved.
   * @param {ScreenPosition} event - mouse or touch event containing the screen position.
   */
  start(mesh, event) {
    if (!this.isManaging(mesh) || isDisabled(this, mesh)) {
      return
    }

    this.autoSelect.clear()
    let sceneUsed = mesh.getScene()
    const meshes = selectionManager.meshes.has(mesh)
      ? [...selectionManager.meshes].filter(
          mesh => this.isManaging(mesh) && mesh.getScene() === sceneUsed
        )
      : [mesh]
    /** @type {Mesh[]} */
    let moved = []
    for (const mesh of meshes) {
      if (
        !meshes.includes(/** @type {Mesh} */ (mesh.parent)) &&
        !isDisabled(this, mesh)
      ) {
        moved.push(mesh)
      }
    }

    // TODO what if no last position?
    let lastPosition = /** @type {Vector3} */ (screenToGround(sceneUsed, event))

    /** @type {Set<DropZone>} */
    let zones = new Set()
    this.inProgress = true
    const actionObserver = controlManager.onActionObservable.add(
      ({ meshId, fn }) => {
        if (fn === actionNames.draw) {
          const mesh = moved.find(({ id }) => id === meshId)
          if (mesh && mesh.getScene() !== this.scene) {
            const idx = moved.indexOf(mesh)
            moved.splice(idx, 1)
            const newMesh = this.scene.getMeshById(meshId)
            if (newMesh) {
              moved.splice(idx, 0, newMesh)
              sceneUsed = this.scene
              lastPosition = newMesh.absolutePosition.clone()
              lastPosition.y -= this.elevation
            }
          }
        }
      }
    )

    const deselectAuto = (/** @type {(?Mesh)[]} */ meshes) => {
      for (const mesh of meshes) {
        if (mesh && this.autoSelect.has(mesh)) {
          selectionManager.unselect(mesh)
          this.autoSelect.delete(mesh)
        }
      }
    }

    const startMoving = (/** @type {Mesh} */ mesh) => {
      if (!selectionManager.meshes.has(mesh)) {
        this.autoSelect.add(mesh)
        selectionManager.select(mesh)
      }
      const { x, y, z } = mesh.absolutePosition
      mesh.setAbsolutePosition(new Vector3(x, y + this.elevation, z))
      controlManager.record({ mesh, pos: mesh.absolutePosition.asArray() })
      this.notifyMove(mesh)
    }

    // dynamically assign continue function to keep moved, zones and lastPosition in scope
    this.continue = (/** @type {ScreenPosition} */ event) => {
      if (moved.length === 0) return
      for (const zone of zones) {
        targetManager.clear(zone)
      }
      zones.clear()

      if (sceneUsed !== this.scene || isAboveTable(this.scene, event)) {
        // TODO what if no current position?
        const currentPosition = /** @type {Vector3} */ (
          screenToGround(sceneUsed, event)
        )
        const move = currentPosition.subtract(lastPosition)
        logger.debug({ moved, event, move }, `continue move operation`)
        lastPosition = currentPosition

        const { min, max } = computeMovedExtend(moved)
        const boundingBoxes = findCollidingBoundingBoxes(sceneUsed, moved, min)
        const newY = elevateWhenColliding(boundingBoxes, min, max)
        if (newY) {
          move.y = newY + this.elevation
        }

        for (const mesh of moved) {
          mesh.setAbsolutePosition(mesh.absolutePosition.addInPlace(move))
          const zone = targetManager.findDropZone(
            mesh,
            /** @type {MoveBehavior} */ (this.behaviorByMeshId.get(mesh.id))
              .state.kind
          )
          if (zone) {
            zones.add(zone)
          }
          controlManager.record({ mesh, pos: mesh.absolutePosition.asArray() })
        }
      } else {
        logger.info(
          { meshes: moved, event },
          `move operation cancelled as the pointer left the table`
        )
        this.stop()
      }
    }

    // dynamically assign getActiveZones function to keep zones in scope
    this.getActiveZones = () => [...zones]

    // dynamically assign exclude function to keep moved in scope
    this.isMoving = (/** @type {?Mesh} */ mesh) => {
      return moved.some(({ id }) => id === mesh?.id)
    }

    // dynamically assign exclude function to keep moved in scope
    this.exclude = (/** @type {(?Mesh)[]} */ ...meshes) => {
      moved = moved.filter(({ id }) =>
        meshes.every(excluded => excluded?.id !== id)
      )
      deselectAuto(meshes)
    }

    // dynamically assign include function to keep moved in scope
    this.include = (/** @type {(?Mesh)[]} */ ...meshes) => {
      for (const mesh of meshes) {
        if (
          mesh &&
          !moved.find(({ id }) => id === mesh.id) &&
          this.isManaging(mesh)
        ) {
          moved.push(mesh)
          startMoving(mesh)
        }
      }
    }

    // dynamically assign stop function to keep moved, zones and lastPosition in scope
    this.stop = async () => {
      if (actionObserver) {
        controlManager.onActionObservable.remove(actionObserver)
      }
      this.continue = () => {}
      this.getActiveZones = () => []
      this.isMoving = () => false
      this.includes = () => {}
      this.exclude = () => {}
      if (moved.length === 0) {
        zones.clear()
        this.inProgress = false
        return
      }

      deselectAuto(moved)
      // trigger drop operation on all identified drop zones
      /** @type {Mesh[]} */
      const dropped = []
      for (const zone of zones) {
        const meshes = targetManager.dropOn(zone)
        logger.info(
          { zone, meshes },
          `completes move operation on target ${meshes.map(({ id }) => id)}`
        )
        for (const mesh of meshes) {
          dropped.push(mesh)
        }
      }
      zones.clear()
      const nonDropped = sortByElevation(
        moved.filter(mesh => !dropped.includes(mesh))
      )
      moved.splice(0, moved.length)

      // and moves remaining meshes
      await Promise.all(
        nonDropped.map((mesh, i) => {
          const { x, y, z } = mesh.absolutePosition
          const {
            state: { snapDistance, duration }
          } = /** @type {MoveBehavior} */ (this.behaviorByMeshId.get(mesh.id))
          const absolutePosition = new Vector3(
            Math.round(x / snapDistance) * snapDistance,
            y,
            Math.round(z / snapDistance) * snapDistance
          )
          logger.info({ mesh }, `end move operation on table ${mesh.id}`)
          return sleep(i * 1.5)
            .then(() =>
              animateMove(mesh, absolutePosition, null, duration, true)
            )
            .then(() =>
              controlManager.record({
                mesh,
                pos: mesh.absolutePosition.asArray()
              })
            )
        })
      )
      this.inProgress = false
    }

    logger.info(
      { moved, position: lastPosition.asArray() },
      `start move operation`
    )
    this.onPreMoveObservable.notifyObservers({ meshes: moved })
    moved = [...moved]
    for (const mesh of moved) {
      startMoving(mesh)
    }
  }

  /**
   * Continues moving mesh(es) according to the last position.
   * Updates the last position and identifies potential targets.
   * Stops the operation when the pointer leaves the table.
   * Does nothing if the operation was not started, or stopped.
   * @param {ScreenPosition} event - mouse or touch event containing the screen position.
   */
  // eslint-disable-next-line no-unused-vars
  continue(event) {}

  /**
   * Removes some of the moved meshes.
   * They will stay with their current position.
   * @param {...?Mesh} meshes - excluded meshes.
   */
  // eslint-disable-next-line no-unused-vars
  exclude(...meshes) {}

  /**
   * Adds some meshes to the moving selection.
   * Does nothing if no operation is in progress.
   * @param {...?Mesh} meshes - included meshes.
   */
  // eslint-disable-next-line no-unused-vars
  include(...meshes) {}

  /**
   * Stops the move operation, releasing mesh(es) on its(their) target if any, or on the table.
   * When released on table, mesh(es) are snapped to the grid with possible animation.
   * Awaits until (all) animation(s) completes.
   * @returns {Promise<void>}
   */
  async stop() {}

  /**
   * Returns all drop zones actives while moving meshes
   * @returns {(DropZone)[]} an array (possibly empty) of active zones
   */
  getActiveZones() {
    return []
  }

  /**
   * @param {?Mesh} mesh - tested mesh
   * @returns {boolean} whether this mesh is being moved
   */
  // eslint-disable-next-line no-unused-vars
  isMoving(mesh) {
    return false
  }

  /**
   * Registers a new MoveBehavior, making it possible to move its mesh.
   * Does nothing if this behavior is already managed.
   * @param {?MoveBehavior} behavior - movable behavior
   */
  registerMovable(behavior) {
    if (behavior?.mesh?.id) {
      this.meshIds.add(behavior.mesh.id)
      this.behaviorByMeshId.set(behavior.mesh.id, behavior)
    }
  }

  /**
   * Unregisters an existing MoveBehavior.
   * Does nothing on unmanaged behaviors.
   * @param {?MoveBehavior} behavior - movable behavior
   */
  unregisterMovable(behavior) {
    if (
      behavior?.mesh &&
      this.isManaging(behavior?.mesh) &&
      !behavior.mesh.isPhantom
    ) {
      this.meshIds.delete(behavior.mesh.id)
      this.behaviorByMeshId.delete(behavior.mesh.id)
    }
  }

  /**
   * @param {?Mesh} [mesh] - tested mesh
   * @returns {boolean} whether this mesh is controlled or not
   */
  isManaging(mesh) {
    return mesh != undefined && this.meshIds.has(mesh.id)
  }

  /**
   * Notify listerners of moving meshes
   * @param {...Mesh} meshes - moving meshes
   */
  notifyMove(...meshes) {
    for (const mesh of meshes) {
      this.onMoveObservable.notifyObservers({ mesh })
    }
  }
}

/**
 * Mesh move manager singleton.
 * @type {MoveManager}
 */
export const moveManager = new MoveManager()

/**
 * @param {Mesh[]} moved - moved meshes.
 * @returns {{ min: Vector3, max: Vector3 }} bounding box info for this group of meshes.
 */
function computeMovedExtend(moved) {
  /** @type {Vector3} */
  let min = Vector3.Zero()
  /** @type {Vector3} */
  let max = Vector3.Zero()
  let initialized = false
  // evaluates the bounding box of all moved meshes
  for (const mesh of moved) {
    mesh.computeWorldMatrix(true)
    const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox
    if (initialized) {
      min = Vector3.Minimize(min, minimumWorld)
      max = Vector3.Maximize(max, maximumWorld)
    } else {
      initialized = true
      min = minimumWorld
      max = maximumWorld
    }
  }
  return { min, max }
}

/**
 * @param {Scene} scene - scene used for moving meshes .
 * @param {Mesh[]} moved - moved meshes.
 * @param {Vector3} min - moved mesh bounding box minimum.
 * @returns {BoundingInfo[]} a list of possibly colliding bounding boxes.
 */
function findCollidingBoundingBoxes({ meshes }, moved, min) {
  /** @type {BoundingInfo[]} */
  const boxes = []
  for (const mesh of meshes) {
    if (
      mesh.isHittable &&
      !moved.includes(mesh) &&
      !selectionManager.meshes.has(mesh)
    ) {
      mesh.computeWorldMatrix(true)
      const box = mesh.getBoundingInfo()
      if (box.boundingBox.maximumWorld.y >= min.y) {
        boxes.push(box)
      }
    }
  }
  return boxes
}

/**
 * @param {BoundingInfo[]} boundingBoxes - a list of possibly colliding bounding boxes.
 * @param {Vector3} min - moved mesh bounding box minimum.
 * @param {Vector3} max - moved mesh bounding box maximum.
 * @return {number} how much the moved meshes should be elevated.
 */
function elevateWhenColliding(boundingBoxes, min, max) {
  const movedBoundingInfo = new BoundingInfo(min, max)
  /** @type {?Vector3} */
  let highest = null
  /** @type {BoundingInfo[]} */
  const removed = []
  for (const box of boundingBoxes) {
    if (movedBoundingInfo.intersects(box, false)) {
      const { maximumWorld } = box.boundingBox
      removed.push(box)
      highest = !highest || highest.y < maximumWorld.y ? maximumWorld : highest
    }
  }
  for (const box of removed) {
    boundingBoxes.splice(boundingBoxes.indexOf(box), 1)
  }
  if (highest) {
    const y = highest.y - min.y
    return (
      y +
      elevateWhenColliding(
        boundingBoxes,
        highest,
        highest.add(max.subtract(min))
      )
    )
  }
  return 0
}

/**
 * @param {MoveManager} manager - manager instance.
 * @param {Mesh} mesh - tested mesh.
 * @returns {boolean} whether this mesh could be moved.
 */
function isDisabled({ behaviorByMeshId }, mesh) {
  return (
    behaviorByMeshId.get(mesh.id)?.enabled === false &&
    (!mesh.metadata?.stack ||
      mesh.metadata.stack.every(
        mesh => behaviorByMeshId.get(mesh.id)?.enabled === false
      ) ||
      !selectionManager.meshes.has(
        mesh.metadata.stack[mesh.metadata.stack.length - 1]
      ))
  )
}
