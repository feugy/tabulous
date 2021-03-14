import Babylon from 'babylonjs'
import { TargetBehavior } from './targetable'
import { animateMove, applyGravity } from '../utils'
import { dragManager } from '../managers'
const { Vector3 } = Babylon

export class DragBehavior {
  constructor({ moveDuration, snapDistance, elevation } = {}) {
    this.enabled = true
    this.snapDistance = snapDistance || 0.25
    this.moveDuration = moveDuration || 0.1
    this.elevation = elevation ? elevation : 0.5
    this.dragStartObserver = null
    this.dragObserver = null
    this.dragEndObserver = null
  }

  get name() {
    return DragBehavior.NAME
  }

  init() {}

  attach(mesh) {
    let target = null
    this.mesh = mesh
    this.dragStartObserver = dragManager.onDragStartObservable.add(dragged => {
      if (dragged.mesh === mesh) {
        mesh.absolutePosition.y += this.elevation
      }
    })

    this.dragObserver = dragManager.onDragObservable.add(dragged => {
      if (dragged.mesh === mesh) {
        // hide previous target and move
        if (target) {
          target.box.visibility = 0
        }
        mesh.setAbsolutePosition(mesh.absolutePosition.add(dragged.move))
        // find and show new target
        target = TargetBehavior.findTarget(mesh)
        TargetBehavior.showTarget(target)
      }
    })

    this.dragEndObserver = dragManager.onDragEndObservable.add(dragged => {
      if (dragged.mesh === mesh) {
        TargetBehavior.hideTarget(target)
        if (target) {
          console.log(`drop ${mesh.id} over ${target.mesh.id}`)
          target.drop()
        } else {
          const { x, y, z } = mesh.absolutePosition
          const absolutePosition = new Vector3(
            Math.round(x / this.snapDistance) * this.snapDistance,
            y,
            Math.round(z / this.snapDistance) * this.snapDistance
          )
          console.log(`end drag ${mesh.id}`)
          animateMove(mesh, absolutePosition, this.moveDuration, applyGravity)
        }
      }
    })
  }

  detach() {
    dragManager.onDragStartObservable.remove(this.dragStartObserver)
    dragManager.onDragObservable.remove(this.dragObserver)
    dragManager.onDragEndObservable.remove(this.dragEndObserver)
  }
}

DragBehavior.NAME = 'draggable'
