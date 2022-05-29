import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Observable } from '@babylonjs/core/Misc/observable'
import { controlManager } from './control'
import { selectionManager } from './selection'
import { targetManager } from './target'
import {
  animateMove,
  isAboveTable,
  screenToGround,
  sortByElevation
} from '../utils'
import { sleep } from '../../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('move')

/**
 * @typedef {object} MoveData
 * @property {object} mesh - moved mesh.
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
   *
   * @property {number} elevation - elevation applied to meshes while dragging them.
   * @property {boolean} inProgress - true while a move operation is in progress.
   * @property {Observable<MoveData>} onMoveObservable - emits when moving a given mesh.
   * @property {Observable<import('@babylonjs/core').Mesh[]>} onPreMoveObservable - emits prior to starting the operation.
   */
  constructor() {
    this.elevation = null
    this.inProgress = false
    this.onMoveObservable = new Observable()
    this.onPreMoveObservable = new Observable()
    // private
    this.scene = null
    this.meshIds = new Set()
    this.behaviorByMeshId = new Map()
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
   * @param {import('@babel/core').Mesh} mesh - to be moved.
   * @param {MouseEvent|TouchEvent} event - mouse or touch event containing the screen position.
   */
  start(mesh, event) {
    if (!this.meshIds.has(mesh?.id) || isDisabled(this, mesh)) {
      return
    }

    let sceneUsed = mesh.getScene()
    let moved = selectionManager.meshes.has(mesh)
      ? [...selectionManager.meshes].filter(
          mesh => this.meshIds.has(mesh?.id) && mesh.getScene() === sceneUsed
        )
      : [mesh]
    const allMoved = [...moved]
    for (const mesh of allMoved) {
      if (allMoved.includes(mesh.parent) || isDisabled(this, mesh)) {
        moved.splice(moved.indexOf(mesh), 1)
      }
    }
    let lastPosition = screenToGround(sceneUsed, event)
    let zones = new Set()
    this.inProgress = true
    const actionObserver = controlManager.onActionObservable.add(
      ({ meshId, fn }) => {
        if (fn === 'draw') {
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

    logger.info(
      { moved, position: lastPosition.asArray() },
      `start move operation`
    )
    this.onPreMoveObservable.notifyObservers(moved)
    moved = [...moved]

    for (const mesh of moved) {
      const { x, y, z } = mesh.absolutePosition
      mesh.setAbsolutePosition(new Vector3(x, y + this.elevation, z))
      controlManager.record({ mesh, pos: mesh.absolutePosition.asArray() })
      this.notifyMove(mesh)
    }

    // dynamically assign continue function to keep moved, zones and lastPosition in scope
    this.continue = event => {
      if (moved.length === 0) return
      for (const zone of zones) {
        targetManager.clear(zone)
      }
      zones.clear()

      if (sceneUsed !== this.scene || isAboveTable(this.scene, event)) {
        const currentPosition = screenToGround(sceneUsed, event)
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
            this.behaviorByMeshId.get(mesh.id).state.kind
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
    this.isMoving = mesh => {
      return moved.some(({ id }) => id === mesh?.id)
    }

    // dynamically assign exclude function to keep moved in scope
    this.exclude = (...meshes) => {
      moved = moved.filter(({ id }) =>
        meshes.every(excluded => excluded?.id !== id)
      )
    }

    // dynamically assign stop function to keep moved, zones and lastPosition in scope
    this.stop = async () => {
      if (actionObserver) {
        controlManager.onActionObservable.remove(actionObserver)
      }
      this.continue = () => {}
      this.getActiveZones = () => []
      this.isMoving = () => false
      this.exclude = () => {}
      if (moved.length === 0) {
        zones.clear()
        this.inProgress = false
        return
      }

      // trigger drop operation on all identified drop zones
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
          } = this.behaviorByMeshId.get(mesh.id)
          const absolutePosition = new Vector3(
            Math.round(x / snapDistance) * snapDistance,
            y,
            Math.round(z / snapDistance) * snapDistance
          )
          logger.info({ mesh }, `end move operation on table ${mesh.id}`)
          return sleep(i * 1.5)
            .then(() => animateMove(mesh, absolutePosition, duration, true))
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
  }

  /**
   * Continues moving mesh(es) according to the last position.
   * Updates the last position and identifies potential targets.
   * Stops the operation when the pointer leaves the table.
   * Does nothing if the operation was not started, or stopped.
   * @param {MouseEvent|TouchEvent} event - mouse or touch event containing the screen position.
   */
  continue() {}

  /**
   * Removes some of the moved meshes.
   * They will stay with their current position.
   * @param {import('@babylonjs/core').Mesh...} meshes - excluded meshes.
   */
  exclude() {}

  /**
   * Stops the move operation, releasing mesh(es) on its(their) target if any, or on the table.
   * When released on table, mesh(es) are snapped to the grid with possible animation.
   * Awaits until (all) animation(s) completes.
   * @async
   */
  async stop() {}

  /**
   * Returns all drop zones actives while moving meshes
   * @return {import('../behaviors').DropZone} an array (possibly empty) of active zones
   */
  getActiveZones() {
    return []
  }

  /**
   * @param {import('@babylonjs/core').Mesh} mesh - tested mesh
   * @returns {boolean} whether this mesh is being moved
   */
  isMoving() {
    return false
  }

  /**
   * Registers a new MoveBehavior, making it possible to move its mesh.
   * Does nothing if this behavior is already managed.
   * @param {MoveBehavior} behavior - movable behavior
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
   * @param {MoveBehavior} behavior - movable behavior
   */
  unregisterMovable(behavior) {
    if (this.meshIds.has(behavior?.mesh?.id) && !behavior.mesh.isPhantom) {
      this.meshIds.delete(behavior.mesh.id)
      this.behaviorByMeshId.delete(behavior.mesh.id)
    }
  }

  /**
   * @param {import('@babel/core').Mesh} mesh - tested mesh
   * @returns {boolean} whether this mesh is controlled or not
   */
  isManaging(mesh) {
    return this.meshIds.has(mesh?.id)
  }

  /**
   * Notify listerners of moving meshes
   * @param {...import('@babel/core').Mesh} meshes - moving meshes
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

function computeMovedExtend(moved) {
  let min
  let max
  // evaluates the bounding box of all moved meshes
  for (const mesh of moved) {
    mesh.computeWorldMatrix(true)
    const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox
    if (!min) {
      min = minimumWorld
      max = maximumWorld
    } else {
      min = Vector3.Minimize(min, minimumWorld)
      max = Vector3.Maximize(max, maximumWorld)
    }
  }
  return { min, max }
}

function findCollidingBoundingBoxes({ meshes }, moved, min) {
  const boxes = []
  for (const mesh of meshes) {
    if (
      mesh.isPickable &&
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

function elevateWhenColliding(boundingBoxes, min, max) {
  const movedBoundingInfo = new BoundingInfo(min, max)
  let highest = null
  const removed = []
  for (const box of boundingBoxes) {
    if (movedBoundingInfo.intersects(box)) {
      const { maximumWorld } = box.boundingBox
      removed.push(box)
      highest = (highest?.y ?? 0) < maximumWorld.y ? maximumWorld : highest
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

function isDisabled({ behaviorByMeshId }, mesh) {
  return (
    behaviorByMeshId.get(mesh.id).enabled === false &&
    (!mesh.metadata?.stack ||
      mesh.metadata.stack.every(
        mesh => behaviorByMeshId.get(mesh.id).enabled === false
      ) ||
      !selectionManager.meshes.has(
        mesh.metadata.stack[mesh.metadata.stack.length - 1]
      ))
  )
}
