import Babylon from 'babylonjs'
import { applyGravity } from '../utils'
const { Animation, Observable } = Babylon

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
    return 'move'
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

  moveTo(to, duration) {
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

    const lastFrame = Math.round(frameRate * duration)
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
          // spirted animation may not exactly end where we want, so force the final position
          mesh.setAbsolutePosition(to)
          applyGravity(mesh)
          onMoveEndObservable.notifyObservers({ mesh, from, duration })
        }
      )
  }
}
