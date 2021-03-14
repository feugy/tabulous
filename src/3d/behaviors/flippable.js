import Babylon from 'babylonjs'
import { MoveBehavior } from './movable'
import { applyGravity } from '../utils'
import { multiSelectionManager } from '../managers'
import { makeLogger } from '../../utils'

const { Animation, Vector3 } = Babylon
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
    this.isFlipped = args.isFlipped || false
  }

  get name() {
    return FlipBehavior.NAME
  }

  flip(duration, skipMulti = false) {
    const {
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
    if (!skipMulti && multiSelectionManager.meshes.includes(mesh)) {
      // when flipping stacks, flip them in order to keep y-ordering
      for (const other of multiSelectionManager.meshes) {
        other.getBehaviorByName(this.name)?.flip(duration, true)
      }
      return
    }
    logger.trace({ mesh }, `start flip ${mesh.id}`)
    this.isMoving = true

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
        value: new Vector3(to.x, to.y + width * 0.75, to.z)
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
          logger.debug({ mesh }, `end flip ${mesh.id}`)
          const from = applyGravity(mesh)
          onMoveEndObservable.notifyObservers({ mesh, from, duration })
        }
      )
  }
}

FlipBehavior.NAME = 'flippable'
