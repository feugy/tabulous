import Babylon from 'babylonjs'
import { MoveBehavior } from './movable'
import { applyGravity } from '../utils'
import { controlManager, multiSelectionManager } from '../managers'
import { makeLogger } from '../../utils'

const { ActionManager, Animation, ExecuteCodeAction, Vector3 } = Babylon
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

  attach(mesh, withAction = true) {
    super.attach(mesh)
    mesh.rotation.z = this.isFlipped ? Math.PI : 0
    if (!mesh.metadata) {
      mesh.metadata = {}
    }
    mesh.metadata.flip = this.flip.bind(this)
    mesh.metadata.isFlipped = this.isFlipped
    if (withAction) {
      if (!mesh.actionManager) {
        mesh.actionManager = new ActionManager(mesh.getScene())
      }
      // OnLeftPickTrigger is fired on pointer down, and we can't cancel it when dragging
      this.action = new ExecuteCodeAction(
        ActionManager.OnPickTrigger,
        ({ sourceEvent: { button } }) => {
          if (button === 0) this.flip()
        }
      )
      mesh.actionManager.registerAction(this.action)
    }
  }

  detach() {
    if (this.action) {
      // TODO it should always be defined?!
      this.mesh.actionManager?.unregisterAction(this.action)
    }
    super.detach()
  }

  flip(skipMulti = false) {
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
    if (!skipMulti && multiSelectionManager.meshes.includes(mesh)) {
      // when flipping stacks, flip them in order to keep y-ordering
      for (const other of multiSelectionManager.meshes) {
        other.getBehaviorByName(this.name)?.flip(true)
      }
      return
    }
    logger.debug({ mesh }, `start flipping ${mesh.id}`)
    this.isMoving = true

    controlManager.record({ meshId: mesh.id, fn: 'flip' })

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
          mesh.metadata.isFlipped = this.isFlipped
          logger.debug({ mesh }, `end flipping ${mesh.id}`)
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
