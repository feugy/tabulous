import Babylon from 'babylonjs'
import { multiSelectionManager } from './multi-selection'
import { screenToGround } from '../utils'
const { Observable, PointerEventTypes, Vector3 } = Babylon

class DragManager {
  constructor() {
    this.onDragStartObservable = new Observable()
    this.onDragObservable = new Observable()
    this.onDragEndObservable = new Observable()
  }

  init({ scene, tolerance = 0.03 } = {}) {
    let position = null
    let picked = null
    let meshes = null

    scene.onPrePointerObservable.add(info => {
      const { type, localPosition, event } = info
      if (type === PointerEventTypes.POINTERDOWN) {
        const { pickedMesh } = scene.pickWithRay(
          scene.createPickingRay(localPosition.x, localPosition.y)
        )
        if (pickedMesh) {
          picked = pickedMesh
          position = screenToGround(scene, localPosition)
          meshes = null
        }
      } else if (type === PointerEventTypes.POINTERMOVE && picked) {
        const current = screenToGround(scene, localPosition)
        if (!meshes && Vector3.Distance(position, current) > tolerance) {
          info.skipOnPointerObservable = true
          // TODO clear selection?
          meshes = multiSelectionManager.meshes.includes(picked)
            ? [...multiSelectionManager.meshes]
            : [picked]
          for (const mesh of meshes) {
            this.onDragStartObservable.notifyObservers({
              position,
              mesh,
              event
            })
          }
        }
        if (meshes) {
          info.skipOnPointerObservable = true
          const move = current.subtract(position)
          position = current
          for (const mesh of meshes) {
            this.onDragObservable.notifyObservers({
              position,
              move,
              mesh,
              event
            })
          }
        }
      } else if (type === PointerEventTypes.POINTERUP && picked) {
        if (meshes) {
          // consider selection order to notify lower items first
          for (const mesh of meshes) {
            this.onDragEndObservable.notifyObservers({ position, mesh, event })
          }
          meshes = null
        }
        picked = null
        position = null
      }
    })
  }
}

export const dragManager = new DragManager()
