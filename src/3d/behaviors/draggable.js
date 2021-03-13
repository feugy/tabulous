import Babylon from 'babylonjs'
import { TargetBehavior } from './targetable'
import { animateMove } from './utils'
const { Observable, PointerDragBehavior, Vector3 } = Babylon

export class DragBehavior {
  constructor({ moveDuration, snapDistance } = {}) {
    this.drag = new PointerDragBehavior({
      dragPlaneNormal: Vector3.Up()
    })
    this.enabled = true
    this.snapDistance = snapDistance || 0.25
    this.moveDuration = moveDuration || 0.1
    this.onDragStartObservable = new Observable()
    this.onDragObservable = new Observable()
    this.onDragEndObservable = new Observable()
  }

  get name() {
    return 'drag'
  }

  init() {}

  attach(mesh) {
    mesh.addBehavior(this.drag)

    const flipBehavior = mesh.getBehaviorByName('flip')
    if (flipBehavior) {
      this.validateDrag = () => !flipBehavior.isMoving
    }

    let initialPos
    let target = null
    let hasMoved = false

    this.drag.onDragStartObservable.add(() => {
      initialPos = mesh.absolutePosition.clone()
      hasMoved = false
    })

    this.drag.onDragObservable.add(event => {
      if (
        !hasMoved &&
        Vector3.Distance(initialPos, mesh.absolutePosition) > 0.01
      ) {
        hasMoved = true
        // TargetBehavior.showTargets()
        this.onDragStartObservable.notifyObservers({
          dragPlanePoint: event.dragPlanePoint,
          pointerId: event.pointerId
        })
        // reset initial position after stack pop
        initialPos = mesh.absolutePosition.clone()
      }
      // don't elevate if we're only holding the mouse button without moving
      if (hasMoved) {
        if (target) {
          target.box.visibility = 0
        }
        mesh.absolutePosition.y = initialPos.y + 0.5
        this.onDragObservable.notifyObservers(event)
        target = TargetBehavior.findTarget(mesh)
        TargetBehavior.showTarget(target)
      }
    })

    this.drag.onDragEndObservable.add(event => {
      if (hasMoved) {
        mesh.renderOverlay = false
        TargetBehavior.hideTarget(target)
        if (target) {
          target.drop()
        } else {
          const { x, z } = mesh.absolutePosition
          const absolutePosition = new Vector3(
            Math.round(x / this.snapDistance) * this.snapDistance,
            initialPos.y,
            Math.round(z / this.snapDistance) * this.snapDistance
          )
          animateMove(mesh, absolutePosition, this.moveDuration, () =>
            this.onDragEndObservable.notifyObservers(event)
          )
        }
      }
    })
  }

  detach() {
    this.drag.attachedNode?.removeBehavior(this.drag)
    this.drag.onDragStartObservable.clear()
    this.drag.onDragObservable.clear()
    this.drag.onDragEndObservable.clear()
  }

  releaseDrag() {
    this.drag.releaseDrag()
  }
}
