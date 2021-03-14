import Babylon from 'babylonjs'
// don't import from index because of circular dependencies
import { center3, screenToGround } from '../utils/vector'
import { makeLogger } from '../../utils'

const { MeshBuilder, Observable, PointerEventTypes, Vector3 } = Babylon
const logger = makeLogger('multi-selection')

class MultiSelectionManager {
  constructor() {
    this.onSelectionActiveObservable = new Observable()
    this.onSelectionResetObservable = new Observable()
    this.start = null
    this.stop = null
    this.meshes = []
  }

  init({ scene } = {}) {
    let selectionBox = null
    let pointerDown = false

    scene.onPrePointerObservable.add(info => {
      const { type, event, localPosition } = info
      if (type === PointerEventTypes.POINTERDOWN) {
        pointerDown = true
        this.start = null
        this.stop = null
        if (this.meshes.length) {
          let hit = scene.pickWithRay(
            scene.createPickingRay(localPosition.x, localPosition.y)
          )
          if (!hit || !this.meshes.includes(hit.pickedMesh)) {
            this.resetSelection()
          }
        }
      } else if (type === PointerEventTypes.POINTERMOVE && event.shiftKey) {
        if (pointerDown && !this.start) {
          // detects a multiple selection operation.
          // create a box to vizualise selected area
          this.start = screenToGround(scene, localPosition)
          selectionBox = MeshBuilder.CreateBox('multi-selection', { size: 0 })
          selectionBox.visibility = 0.2
          selectionBox.isPickable = false
          selectionBox.position = this.start
          this.meshes = []
        }
        if (this.start) {
          // updates size and position of the multiple selection box.
          // its position is the center of operation start and current position, then we scale it
          info.skipOnPointerObservable = true
          const current = screenToGround(scene, localPosition)
          selectionBox.position = center3(this.start, current)
          selectionBox.scaling = new Vector3(
            Math.abs(current.x - this.start.x),
            1,
            Math.abs(current.z - this.start.z)
          )
        }
      } else if (type === PointerEventTypes.POINTERUP) {
        pointerDown = false
        if (this.start) {
          // end of a multiple selection: find selected meshes
          for (const mesh of scene.meshes) {
            if (mesh.isPickable && selectionBox.intersectsMesh(mesh)) {
              this.meshes.push(mesh)
              mesh.renderOverlay = true
            }
          }
          // order selection per y-order, so applyGravity could handle overlap
          this.meshes.sort(
            (a, b) => a.absolutePosition.y - b.absolutePosition.y
          )
          logger.debug(
            { selection: this.meshes },
            `new multiple selection: ${this.meshes.map(({ id }) => id)}`
          )
          selectionBox?.dispose()
          this.stop = screenToGround(scene, localPosition)
          this.onSelectionActiveObservable.notifyObservers()
        }
      }
    })
  }

  resetSelection() {
    if (this.meshes.length) {
      this.onSelectionResetObservable.notifyObservers()
      this.start = null
      this.stop = null
      for (const mesh of this.meshes) {
        mesh.renderOverlay = false
      }
      this.meshes = []
    }
  }
}

export const multiSelectionManager = new MultiSelectionManager()
