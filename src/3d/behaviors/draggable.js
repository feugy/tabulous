import Babylon from 'babylonjs'
import { animateMove, applyGravity } from '../utils'
import { controlManager, dragManager, targetManager } from '../managers'
import { makeLogger } from '../../utils'

const { Vector3 } = Babylon

const logger = makeLogger('draggable')

export class DragBehavior {
  constructor({ moveDuration, snapDistance, elevation, dragKind } = {}) {
    this.enabled = true
    this.snapDistance = snapDistance || 0.25
    this.moveDuration = moveDuration || 0.1
    this.elevation = elevation ? elevation : 0.5
    this.dragKind = dragKind
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
        controlManager.record({
          meshId: mesh.id,
          pos: mesh.absolutePosition.asArray()
        })
      }
    })

    this.dragObserver = dragManager.onDragObservable.add(dragged => {
      if (dragged.mesh === mesh) {
        // hide previous target and move
        if (target) {
          targetManager.hideTarget(target)
          target = null
        }
        mesh.setAbsolutePosition(mesh.absolutePosition.addInPlace(dragged.move))
        controlManager.record({
          meshId: mesh.id,
          pos: mesh.absolutePosition.asArray()
        })
        // find and show new target
        target = targetManager.findTarget(mesh, this.dragKind)
        targetManager.showTarget(target)
      }
    })

    this.dragEndObserver = dragManager.onDragEndObservable.add(dragged => {
      if (dragged.mesh === mesh) {
        targetManager.hideTarget(target)
        if (target) {
          logger.debug(
            { dropped: mesh, target },
            `drop ${mesh.id} over ${target.mesh.id}`
          )
          target.drop()
        } else {
          const { x, y, z } = mesh.absolutePosition
          const absolutePosition = new Vector3(
            Math.round(x / this.snapDistance) * this.snapDistance,
            y,
            Math.round(z / this.snapDistance) * this.snapDistance
          )
          logger.debug({ dragged: mesh }, `end drag ${mesh.id}`)
          animateMove(mesh, absolutePosition, this.moveDuration, mesh =>
            controlManager.record({
              meshId: mesh.id,
              pos: applyGravity(mesh).asArray()
            })
          )
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
