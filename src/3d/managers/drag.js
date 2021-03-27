import Babylon from 'babylonjs'
import { multiSelectionManager } from './multi-selection'
import { isAboveTable, screenToGround } from '../utils'
import { makeLogger } from '../../utils'

const { Observable, PointerEventTypes, Vector3 } = Babylon

const logger = makeLogger('draggable')

class DragManager {
  constructor() {
    this.onDragStartObservable = new Observable()
    this.onDragObservable = new Observable()
    this.onDragEndObservable = new Observable()
    this.position = null
    this.picked = null
    this.meshes = null
  }

  init({ scene, tolerance = 0.03 } = {}) {
    scene.onPrePointerObservable.add(info => {
      const { type, localPosition, event } = info
      if (type === PointerEventTypes.POINTERDOWN) {
        const { pickedMesh } = scene.pickWithRay(
          scene.createPickingRay(localPosition.x, localPosition.y)
        )
        if (pickedMesh) {
          this.picked = pickedMesh
          this.position = screenToGround(scene, localPosition)
          this.meshes = null
        }
      } else if (type === PointerEventTypes.POINTERMOVE && this.picked) {
        const current = screenToGround(scene, localPosition)
        if (
          !this.meshes &&
          Vector3.Distance(this.position, current) > tolerance
        ) {
          info.skipOnPointerObservable = true
          // TODO clear selection?
          this.meshes = multiSelectionManager.meshes.includes(this.picked)
            ? [...multiSelectionManager.meshes]
            : [this.picked]
          for (const mesh of this.meshes) {
            this.onDragStartObservable.notifyObservers({
              position: this.position,
              mesh,
              event
            })
          }
        }
        if (this.meshes) {
          if (isAboveTable(scene, localPosition)) {
            info.skipOnPointerObservable = true
            const move = current.subtract(this.position)
            this.position = current

            let highest = 0
            for (const mesh of this.meshes) {
              // check possible collision, except within current selection
              for (const other of mesh.getScene().meshes) {
                if (
                  other.isPickable &&
                  !this.meshes.includes(other) &&
                  mesh.intersectsMesh(other) &&
                  !multiSelectionManager.meshes.includes(other)
                ) {
                  const { y } = other.getBoundingInfo().boundingBox.maximumWorld
                  highest = highest < y ? y : highest
                }
              }
            }
            move.y = highest
            for (const mesh of this.meshes) {
              this.onDragObservable.notifyObservers({
                position: this.position,
                move,
                mesh,
                event
              })
            }
          } else {
            logger.debug(
              { meshes: this.meshes, localPosition },
              `drag operation cancelled because it left the table`
            )
            this.cancel(event)
          }
        }
      } else if (type === PointerEventTypes.POINTERUP && this.picked) {
        this.cancel(event)
      }
    })
  }

  cancel(event) {
    if (this.meshes) {
      // consider selection order to notify lower items first
      for (const mesh of this.meshes) {
        this.onDragEndObservable.notifyObservers({
          position: this.position,
          mesh,
          event
        })
      }
      this.meshes = null
    }
    this.picked = null
    this.position = null
  }
}

export const dragManager = new DragManager()
