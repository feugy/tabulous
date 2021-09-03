import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { controlManager, selectionManager, targetManager } from '.'
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

class MoveManager {
  /**
   * Creates a manager to move meshes with MoveBehavior:
   * - can start, continue and stop moving managed mesh
   * - moves the entier selection if it contains the moved mesh
   * - triggers target detection while continuing the operation
   * - release mesh on table, or on their relevant target
   *
   * @property {number} elevation - elevation applied to meshes while dragging them.
   * @property {boolean} inProgress - true while a move operation is in progress.
   */
  constructor() {
    this.elevation = null
    this.inProgress = false
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
  init({ scene, elevation = 0.5 } = {}) {
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
    if (
      !this.meshIds.has(mesh?.id) ||
      !this.behaviorByMeshId.get(mesh?.id).enabled
    ) {
      return
    }

    const moved = selectionManager.meshes.has(mesh)
      ? [...selectionManager.meshes].filter(mesh => this.meshIds.has(mesh?.id))
      : [mesh]
    let lastPosition = screenToGround(this.scene, event)
    let zones = new Set()
    this.inProgress = true

    logger.info(
      { moved, position: lastPosition.asArray() },
      `start move operation`
    )

    for (const mesh of moved) {
      mesh.absolutePosition.y += this.elevation
      controlManager.record({
        meshId: mesh.id,
        pos: mesh.absolutePosition.asArray()
      })
    }

    // dynamically assign continue function to keep moved, zones and lastPosition in scope
    this.continue = event => {
      if (moved.length === 0) return
      for (const zone of zones) {
        targetManager.clear(zone)
      }
      zones.clear()

      if (isAboveTable(this.scene, event)) {
        const currentPosition = screenToGround(this.scene, event)
        const move = currentPosition.subtract(lastPosition)
        logger.debug({ moved, event, move }, `continue move operation`)
        lastPosition = currentPosition

        let min
        let max
        // evaluates the bounding box of all moved meshes
        for (const mesh of moved) {
          const {
            minimumWorld,
            maximumWorld
          } = mesh.getBoundingInfo().boundingBox
          if (!min) {
            min = minimumWorld
            max = maximumWorld
          } else {
            min = Vector3.Minimize(min, minimumWorld)
            max = Vector3.Maximize(max, maximumWorld)
          }
        }
        const movedBoundingInfo = new BoundingInfo(min, max)

        let highest = 0
        // check possible collision, except within current selection or currently moved
        for (const other of this.scene.meshes.filter(
          mesh =>
            mesh.isPickable &&
            !moved.includes(mesh) &&
            !selectionManager.meshes.has(mesh)
        )) {
          const otherBox = other.getBoundingInfo()
          if (movedBoundingInfo.intersects(otherBox)) {
            const { y } = otherBox.boundingBox.maximumWorld
            highest = highest < y ? y : highest
          }
        }
        // elevates moved mesh in case of collision
        if (highest) {
          move.y = highest - min.y
        }

        for (const mesh of moved) {
          const zone = targetManager.findDropZone(
            mesh,
            this.behaviorByMeshId.get(mesh.id).dragKind
          )
          if (zone) {
            zones.add(zone)
          }
          mesh.setAbsolutePosition(mesh.absolutePosition.addInPlace(move))
          controlManager.record({
            meshId: mesh.id,
            pos: mesh.absolutePosition.asArray()
          })
        }
      } else {
        logger.info(
          { meshes: moved, event },
          `move operation cancelled as the pointer left the table`
        )
        this.stop()
      }
    }

    // dynamically assign stop function to keep moved, zones and lastPosition in scope
    this.stop = async () => {
      if (moved.length === 0) return

      // trigger drop operation on all identified drop zones
      const droppedIds = new Set()
      for (const zone of zones) {
        const meshes = targetManager.dropOn(zone)
        logger.info({ zone, meshes }, `completes move operation on target`)
        for (const mesh of meshes) {
          droppedIds.add(mesh.id)
        }
      }
      zones.clear()
      const nonDropped = sortByElevation(
        moved.filter(mesh => !droppedIds.has(mesh.id))
      )
      moved.splice(0, moved.length)

      // and moves remaining meshes
      await Promise.all(
        nonDropped.map((mesh, i) => {
          const { x, y, z } = mesh.absolutePosition
          const { snapDistance, moveDuration } = this.behaviorByMeshId.get(
            mesh.id
          )
          const absolutePosition = new Vector3(
            Math.round(x / snapDistance) * snapDistance,
            y,
            Math.round(z / snapDistance) * snapDistance
          )
          logger.info({ mesh }, `end move operation on table ${mesh.id}`)
          return sleep(i * 1.5)
            .then(() => animateMove(mesh, absolutePosition, moveDuration, true))
            .then(() =>
              controlManager.record({
                meshId: mesh.id,
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
   * Stops the move operation, releasing mesh(es) on its(their) target if any, or on the table.
   * When released on table, mesh(es) are snapped to the grid with possible animation.
   * Awaits until (all) animation(s) completes.
   * @async
   */
  async stop() {}

  /**
   * Registers a new MoveBehavior, making it possible to move its mesh.
   * Does nothing if this behavior is already managed.
   * @param {MoveBehavior} behavior - movable behavior
   */
  registerMovable(behavior) {
    if (behavior?.mesh?.id && !this.meshIds.has(behavior.mesh.id)) {
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
    if (this.meshIds.has(behavior?.mesh?.id)) {
      this.meshIds.delete(behavior.mesh.id)
      this.behaviorByMeshId.delete(behavior.mesh.id)
    }
  }
}

/**
 * Mesh move manager singleton.
 * @type {MoveManager}
 */
export const moveManager = new MoveManager()