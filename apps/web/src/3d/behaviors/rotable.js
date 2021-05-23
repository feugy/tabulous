import {
  ActionManager,
  Animation,
  ExecuteCodeAction,
  Vector3
} from '@babylonjs/core'
import { MoveBehavior } from './movable'
import { applyGravity } from '../utils'
import { controlManager, multiSelectionManager } from '../managers'
import { makeLogger } from '../../utils'

const logger = makeLogger('rotable')

export class RotateBehavior extends MoveBehavior {
  constructor(args) {
    super(args)
    this.rotateAnimation = new Animation(
      'rotate',
      'rotation.y',
      this.frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
    this.duration = args.duration || 0.5
    this.action = null
    this.angle = args.angle || 0
  }

  get name() {
    return RotateBehavior.NAME
  }

  attach(mesh, withAction = true) {
    super.attach(mesh)
    mesh.rotation.y = this.angle * 0.5 * Math.PI
    if (!mesh.metadata) {
      mesh.metadata = {}
    }
    mesh.metadata.rotate = this.rotate.bind(this)
    mesh.metadata.angle = this.angle
    if (withAction) {
      if (!mesh.actionManager) {
        mesh.actionManager = new ActionManager(mesh.getScene())
      }
      // OnLeftPickTrigger is fired on pointer down, and we can't cancel it when dragging
      this.action = new ExecuteCodeAction(
        ActionManager.OnPickTrigger,
        ({ sourceEvent: { button } }) => {
          if (button === 2) this.rotate()
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

  rotate(skipMulti = false) {
    const {
      duration,
      isMoving,
      angle,
      mesh,
      frameRate,
      rotateAnimation,
      moveAnimation,
      onMoveStartObservable,
      onMoveEndObservable
    } = this
    if (isMoving) {
      return
    }
    if (
      !skipMulti &&
      !mesh.metadata?.fromPeer &&
      multiSelectionManager.meshes.includes(mesh)
    ) {
      // when rotating stacks, rotate them in order to keep y-ordering
      for (const other of multiSelectionManager.meshes) {
        other.getBehaviorByName(this.name)?.rotate(true)
      }
      return
    }
    logger.debug({ mesh }, `start rotating ${mesh.id}`)
    this.isMoving = true

    if (!mesh.metadata?.fromPeer) {
      controlManager.record({ meshId: mesh.id, fn: 'rotate' })
    }

    const to = mesh.absolutePosition.clone()
    onMoveStartObservable.notifyObservers({ mesh, to, duration })

    const lastFrame = Math.round(frameRate * duration)
    rotateAnimation.setKeys([
      { frame: 0, value: angle * 0.5 * Math.PI },
      { frame: lastFrame, value: (angle + 1) * 0.5 * Math.PI }
    ])
    moveAnimation.setKeys([
      { frame: 0, value: to },
      {
        frame: lastFrame * 0.5,
        value: new Vector3(to.x, to.y + 0.5, to.z)
      },
      { frame: lastFrame, value: to }
    ])
    mesh
      .getScene()
      .beginDirectAnimation(
        mesh,
        [rotateAnimation, moveAnimation],
        0,
        lastFrame,
        false,
        1,
        () => {
          this.isMoving = false
          this.angle = (this.angle + 1) % 4
          mesh.metadata.angle = this.angle
          logger.debug({ mesh }, `end rotating ${mesh.id}`)
          // framed animation may not exactly end where we want, so force the final position
          mesh.setAbsolutePosition(to)
          const from = applyGravity(mesh)
          onMoveEndObservable.notifyObservers({ mesh, from, duration })
        }
      )
  }

  serialize() {
    return { angle: this.angle }
  }
}

RotateBehavior.NAME = 'rotable'
