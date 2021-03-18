import Babylon from 'babylonjs'
import { MoveBehavior } from './movable'
import { applyGravity } from '../utils'
import { multiSelectionManager } from '../managers'
import { makeLogger } from '../../utils'

const { ActionManager, Animation, ExecuteCodeAction, Vector3 } = Babylon
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
    this.rotation = args.rotation || 0
  }

  get name() {
    return RotateBehavior.NAME
  }

  attach(mesh, withAction = true) {
    super.attach(mesh)
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
      rotation,
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
    if (!skipMulti && multiSelectionManager.meshes.includes(mesh)) {
      // when rotating stacks, rotate them in order to keep y-ordering
      for (const other of multiSelectionManager.meshes) {
        other.getBehaviorByName(this.name)?.rotate(true)
      }
      return
    }
    logger.trace({ mesh }, `start rotating ${mesh.id}`)
    this.isMoving = true

    const to = mesh.absolutePosition.clone()
    onMoveStartObservable.notifyObservers({ mesh, to, duration })

    const lastFrame = Math.round(frameRate * duration)
    rotateAnimation.setKeys([
      { frame: 0, value: rotation * 0.5 * Math.PI },
      { frame: lastFrame, value: (rotation + 1) * 0.5 * Math.PI }
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
          logger.debug({ mesh }, `end rotating ${mesh.id}`)
          this.rotation = (this.rotation + 1) % 4
          const from = applyGravity(mesh)
          onMoveEndObservable.notifyObservers({ mesh, from, duration })
        }
      )
  }
}

RotateBehavior.NAME = 'rotable'
