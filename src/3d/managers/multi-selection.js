import Babylon from 'babylonjs'
import { default as earcut } from 'earcut'
import { controlManager } from './control'
// don't import from index because of circular dependencies
import { screenToGround } from '../utils/vector'
import { isContaining } from '../utils/mesh'
import { makeLogger } from '../../utils'

const { Color3, MeshBuilder, Observable, PointerEventTypes } = Babylon
const logger = makeLogger('multi-selection')

class MultiSelectionManager {
  constructor() {
    this.onSelectionActiveObservable = new Observable()
    this.onSelectionResetObservable = new Observable()
    this.onOverObservable = new Observable()
    this.onOutObservable = new Observable()
    this.start = null
    this.startPosition = null
    this.meshes = []
    this.hoverable = new Set()
    this.hovered = null
  }

  init({ scene } = {}) {
    let selectionBox = null
    let selectionHint = null
    let pointerDown = false

    scene.onPrePointerObservable.add(info => {
      const { type, event, localPosition } = info
      if (type === PointerEventTypes.POINTERDOWN) {
        pointerDown = true
        this.start = null
        // TODO alter current selection on ctrlKey
        if (this.meshes.length) {
          let hit = scene.pickWithRay(
            scene.createPickingRay(localPosition.x, localPosition.y)
          )
          if (!hit || !this.meshes.includes(hit.pickedMesh)) {
            this.resetSelection()
          }
        }
      } else if (type === PointerEventTypes.POINTERMOVE) {
        const position = screenToGround(scene, localPosition)
        if (!position) {
          return
        }
        controlManager.recordPointer(position)
        if (event.shiftKey) {
          if (pointerDown && !this.start) {
            // detects a multiple selection operation.
            // create a box to vizualise selected area
            this.start = position
            this.meshes = []
            this.startPosition = { ...localPosition }
          }
          if (this.start) {
            info.skipOnPointerObservable = true

            const width = this.startPosition.x - localPosition.x
            const height = this.startPosition.y - localPosition.y

            selectionBox?.dispose()
            selectionHint?.dispose()
            const depth = scene.activeCamera.position.y
            selectionBox = MeshBuilder.ExtrudePolygon(
              'selection-box',
              {
                shape: [
                  this.start,
                  screenToGround(scene, {
                    x: this.startPosition.x - width,
                    y: this.startPosition.y
                  }),
                  position,
                  screenToGround(scene, {
                    x: this.startPosition.x,
                    y: this.startPosition.y - height
                  }),
                  this.start
                ],
                depth
              },
              scene,
              earcut
            )
            selectionBox.visibility = 0
            selectionBox.isPickable = false
            selectionBox.position.y += depth

            selectionHint = MeshBuilder.CreateLines('selection-hint', {
              points: [
                this.start,
                screenToGround(scene, {
                  x: this.startPosition.x - width,
                  y: this.startPosition.y
                }),
                position,
                screenToGround(scene, {
                  x: this.startPosition.x,
                  y: this.startPosition.y - height
                }),
                this.start
              ],
              colors: Array.from({ length: 6 }, () => Color3.Green().toColor4())
            })
          }
        }
        const mesh = scene
          .multiPickWithRay(
            scene.createPickingRay(localPosition.x, localPosition.y),
            mesh => this.hoverable.has(mesh)
          )
          .sort((a, b) => a.distance - b.distance)[0]?.pickedMesh
        if (mesh) {
          this.onOverObservable.notifyObservers({
            event,
            mesh,
            selection: this.meshes
          })
          this.hovered = mesh
        } else if (this.hovered) {
          this.onOutObservable.notifyObservers({
            event,
            mesh: this.hovered,
            selection: this.meshes
          })
          this.hovered = null
        }
      } else if (type === PointerEventTypes.POINTERUP) {
        pointerDown = false
        if (this.start) {
          // end of a multiple selection: find selected meshes
          for (const mesh of scene.meshes) {
            if (
              mesh.isPickable &&
              selectionBox &&
              isContaining(selectionBox, mesh)
            ) {
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
          selectionHint?.dispose()
          this.start = null
          this.startPosition = null
          this.onSelectionActiveObservable.notifyObservers()
        }
      }
    })
  }

  resetSelection() {
    if (this.meshes.length) {
      this.onSelectionResetObservable.notifyObservers()
      for (const mesh of this.meshes) {
        mesh.renderOverlay = false
      }
      this.meshes = []
    }
  }

  registerHoverable(behavior) {
    if (!this.hoverable.has(behavior.mesh)) {
      this.hoverable.add(behavior.mesh)
    }
  }

  unregisterHoverable(behavior) {
    if (this.hoverable.has(behavior.mesh)) {
      this.hoverable.delete(behavior.mesh)
    }
  }

  cancel(event) {
    if (this.hovered) {
      this.onOutObservable.notifyObservers({
        event,
        mesh: this.hovered,
        selection: this.meshes
      })
      this.hovered = null
    }
  }
}

export const multiSelectionManager = new MultiSelectionManager()
