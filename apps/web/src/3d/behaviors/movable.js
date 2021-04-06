import { Animation, Observable } from '@babylonjs/core'
import { applyGravity } from '../utils'

export class MoveBehavior {
  constructor({ frameRate } = {}) {
    this.frameRate = frameRate || 30
    this.moveAnimation = new Animation(
      'move',
      'position',
      this.frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
    this.mesh = null
    this.isMoving = false
    this.onMoveStartObservable = new Observable()
    this.onMoveEndObservable = new Observable()
  }

  get name() {
    return MoveBehavior.NAME
  }

  init() {}

  attach(mesh) {
    if (!this.mesh) {
      this.mesh = mesh
    }
  }

  detach() {
    this.mesh = null
  }

  moveTo(to, duration, gravity = true) {
    const {
      isMoving,
      mesh,
      frameRate,
      moveAnimation,
      onMoveStartObservable,
      onMoveEndObservable
    } = this
    if (isMoving) {
      return
    }
    this.isMoving = true
    const from = mesh.absolutePosition.clone()
    onMoveStartObservable.notifyObservers({ mesh, to, duration })

    const lastFrame = mesh.getScene().isLoading
      ? 1
      : Math.round(frameRate * duration)
    moveAnimation.setKeys([
      { frame: 0, value: from },
      { frame: lastFrame, value: to }
    ])
    mesh
      .getScene()
      .beginDirectAnimation(
        mesh,
        [moveAnimation],
        0,
        lastFrame,
        false,
        1,
        () => {
          this.isMoving = false
          // framed animation may not exactly end where we want, so force the final position
          mesh.setAbsolutePosition(to)
          if (gravity) {
            applyGravity(mesh)
          }
          onMoveEndObservable.notifyObservers({ mesh, from, duration })
        }
      )
  }
}

MoveBehavior.NAME = 'movable'
