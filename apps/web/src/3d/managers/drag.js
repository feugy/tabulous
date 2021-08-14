import { Vector3 } from '@babylonjs/core'
import { controlManager, inputManager, targetManager } from '.'
import { selectionManager } from './selection'
import {
  animateMove,
  applyGravity,
  isAboveTable,
  screenToGround
} from '../utils'
import { makeLogger, sleep } from '../../utils'

const logger = makeLogger('drag')

class DragManager {
  /**
   * Creates a manager to drag meshe with Draggable behavior:
   * - binds to input do detect drag on draggable meshes
   * - moves them while moving the pointer
   * - triggers target detection
   * - drop them on table, or on their relevant target
   * - supports multiple selection
   */
  constructor() {
    // private
    this.draggableMeshIds = new Set()
    this.behaviorByMeshId = new Map()
  }

  /**
   * Gives a scene to the manager, and binds on input manager observables.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - scene attached to.
   * @param {number} [params.elevation=0.5] - altitude applied to meshes while dragging them.
   */
  init({ scene, elevation = 0.5 } = {}) {
    const targets = new Set()
    let lastPosition = null
    let dragged = []

    // dynamically creates stopDrag to keep dragged and targets hidden
    this.stopDrag = () => {
      if (dragged.length === 0) return

      // trigger drop operation on all identified targets
      const droppedIds = new Set()
      for (const target of targets) {
        logger.debug({ target }, `completes drop`)
        for (const dropped of targetManager.dropOn(target)) {
          droppedIds.add(dropped.id)
        }
      }
      targets.clear()

      // and moves remaining meshes
      // TODO Fix: when moving stacks, gravity is applied concurrently
      Promise.all(
        dragged
          .filter(mesh => !droppedIds.has(mesh.id))
          // sort them by elevation (lowest first) for gravity computations
          .sort((a, b) => a.absolutePosition.y - b.absolutePosition.y)
          .map((mesh, i) => {
            const { x, y, z } = mesh.absolutePosition
            const { snapDistance, moveDuration } = this.behaviorByMeshId.get(
              mesh.id
            )
            const absolutePosition = new Vector3(
              Math.round(x / snapDistance) * snapDistance,
              y,
              Math.round(z / snapDistance) * snapDistance
            )
            logger.debug({ dragged: mesh }, `end drag ${mesh.id}`)
            return sleep(i * 1.5)
              .then(() => animateMove(mesh, absolutePosition, moveDuration))
              .then(() =>
                controlManager.record({
                  meshId: mesh.id,
                  pos: applyGravity(mesh).asArray()
                })
              )
          })
      )
      dragged = []
    }

    inputManager.onDragObservable.add(({ type, mesh, event }) => {
      if (!this.draggableMeshIds.has(mesh?.id)) return
      const screenPosition = { x: event.clientX, y: event.clientY }

      if (type === 'dragStart') {
        dragged = selectionManager.meshes.includes(mesh)
          ? selectionManager.meshes.filter(mesh =>
              this.draggableMeshIds.has(mesh?.id)
            )
          : [mesh]
        lastPosition = screenToGround(scene, screenPosition)

        for (const mesh of dragged) {
          mesh.absolutePosition.y += elevation
          controlManager.record({
            meshId: mesh.id,
            pos: mesh.absolutePosition.asArray()
          })
        }
      } else if (type === 'drag' && dragged.length) {
        for (const target of targets) {
          targetManager.clear(target)
        }
        targets.clear()

        if (isAboveTable(scene, screenPosition)) {
          const currentPosition = screenToGround(scene, screenPosition)
          const move = currentPosition.subtract(lastPosition)
          lastPosition = currentPosition

          let highest = 0
          for (const mesh of dragged) {
            // check possible collision, except within current selection
            for (const other of mesh.getScene().meshes) {
              if (
                other.isPickable &&
                !dragged.includes(other) &&
                mesh.intersectsMesh(other) &&
                !selectionManager.meshes.includes(other)
              ) {
                const { y } = other.getBoundingInfo().boundingBox.maximumWorld
                highest = highest < y ? y : highest
              }
            }
          }
          move.y = highest

          for (const mesh of dragged) {
            const target = targetManager.findTarget(
              mesh,
              this.behaviorByMeshId.get(mesh.id).dragKind
            )
            if (target) {
              targets.add(target)
            }
            mesh.setAbsolutePosition(mesh.absolutePosition.addInPlace(move))
            controlManager.record({
              meshId: mesh.id,
              pos: mesh.absolutePosition.asArray()
            })
          }
        } else {
          logger.debug(
            { meshes: dragged, event },
            `drag operation cancelled because it left the table`
          )
          this.stopDrag()
        }
      } else if (type === 'dragStop') {
        this.stopDrag()
      }
    })
  }

  /**
   * Registers a new Draggable behavior, making it possible to drag its mesh.
   * Does nothing if this behavior is already managed.
   * @param {Draggable} behavior - draggable behavior
   */
  registerDraggable(behavior) {
    if (behavior?.mesh?.id && !this.draggableMeshIds.has(behavior.mesh.id)) {
      this.draggableMeshIds.add(behavior.mesh.id)
      this.behaviorByMeshId.set(behavior.mesh.id, behavior)
    }
  }

  /**
   * Unregisters an existing Draggable behavior.
   * Does nothing on unmanaged behaviors.
   * @param {Draggable} behavior - draggable behavior
   */
  unregisterDraggable(behavior) {
    if (this.draggableMeshIds.has(behavior?.mesh?.id)) {
      this.draggableMeshIds.delete(behavior.mesh.id)
      this.behaviorByMeshId.delete(behavior.mesh.id)
    }
  }

  /**
   * Stop the drag operation, releasing meshes on their target, or on table
   */
  stopDrag() {}
}

/**
 * Mesh drag manager singleton.
 * @type {DragManager}
 */
export const dragManager = new DragManager()
