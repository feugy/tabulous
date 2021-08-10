import { Animation, Vector3 } from '@babylonjs/core'
import { MoveBehavior } from './movable'
import { applyGravity } from '../utils'
import { controlManager, multiSelectionManager } from '../managers'
import { makeLogger } from '../../utils'

const logger = makeLogger('flippable')

export class FlipBehavior extends MoveBehavior {
  constructor(args) {
    super(args)
    this.flipAnimation = new Animation(
      'flip',
      'rotation.z',
      this.frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
    this.duration = args.duration || 0.5
    this.isFlipped = args.isFlipped || false
    this.action = null
  }

  get name() {
    return FlipBehavior.NAME
  }

  attach(mesh) {
    super.attach(mesh)
    mesh.rotation.z = this.isFlipped ? Math.PI : 0
    if (!mesh.metadata) {
      mesh.metadata = {}
    }
    mesh.metadata.flip = this.flip.bind(this)
    mesh.metadata.isFlipped = this.isFlipped
  }

  flip(single = false) {
    const {
      duration,
      isMoving,
      isFlipped,
      mesh,
      frameRate,
      flipAnimation,
      moveAnimation,
      onMoveStartObservable,
      onMoveEndObservable
    } = this
    if (isMoving) {
      return
    }
    if (
      !single &&
      !mesh.metadata?.fromPeer &&
      multiSelectionManager.meshes.includes(mesh)
    ) {
      for (const selected of multiSelectionManager.meshes) {
        if (selected.metadata?.flip) {
          selected.metadata.flip(true)
        }
      }
      return
    }
    logger.debug({ mesh }, `start flipping ${mesh.id}`)
    this.isMoving = true

    if (!mesh.metadata?.fromPeer) {
      controlManager.record({ meshId: mesh.id, fn: 'flip' })
    }

    const to = mesh.absolutePosition.clone()
    const [min, max] = mesh.getBoundingInfo().boundingBox.vectorsWorld
    const width = Math.abs(min.x - max.x)
    onMoveStartObservable.notifyObservers({ mesh, to, duration })

    const lastFrame = Math.round(frameRate * duration)
    flipAnimation.setKeys([
      { frame: 0, value: isFlipped ? Math.PI : 0 },
      { frame: lastFrame, value: isFlipped ? 0 : Math.PI }
    ])
    moveAnimation.setKeys([
      { frame: 0, value: to },
      {
        frame: lastFrame * 0.5,
        value: new Vector3(to.x, to.y + width, to.z)
      },
      { frame: lastFrame, value: to }
    ])
    mesh
      .getScene()
      .beginDirectAnimation(
        mesh,
        [flipAnimation, moveAnimation],
        0,
        lastFrame,
        false,
        1,
        () => {
          this.isMoving = false
          this.isFlipped = !isFlipped
          mesh.metadata.isFlipped = this.isFlipped
          logger.debug({ mesh }, `end flipping ${mesh.id}`)
          // framed animation may not exactly end where we want, so force the final position
          mesh.setAbsolutePosition(to)
          const from = applyGravity(mesh)
          onMoveEndObservable.notifyObservers({ mesh, from, duration })
        }
      )
  }

  serialize() {
    return { isFlipped: this.isFlipped }
  }
}

FlipBehavior.NAME = 'flippable'
