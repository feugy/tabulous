import { Animation } from '@babylonjs/core/Animations/animation'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { AnimateBehavior } from './animatable'
import { RotateBehaviorName } from './names'
import { applyGravity } from '../utils'
import { controlManager } from '../managers'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('rotable')

/**
 * @typedef {object} RotableState behavior persistent state, including:
 * @property {number} angle - current rotation (in radian).
 * @property {number} [duration=200] - duration (in milliseconds) of the rotation animation.
 */

export class RotateBehavior extends AnimateBehavior {
  /**
   * Creates behavior to make a mesh rotable with animation.
   * It will add to this mesh's metadata:
   * - a `rotate()` function to rotate by 45°.
   * - a rotation `angle` (in radian).
   *
   * @extends {AnimateBehavior}
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {RotableState} state - the behavior's current state.
   *
   * @param {RotableState} state - behavior state.
   */
  constructor(state = {}) {
    super(state)
    this.state = state
    // private
    this.rotateAnimation = new Animation(
      'rotate',
      'rotation.y',
      this.frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return RotateBehaviorName
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - the `angle` property.
   * - the `rotate()` method.
   * It initializes its rotation according to angle.
   * When attaching/detaching this mesh to a parent, adjust rotation angle
   * according to the parent's own rotation, so that rotating the parent
   * will accordingly rotate the child.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this.state)
  }

  /**
   * Detaches this behavior from its mesh.
   */
  detach() {
    this.mesh.setParent = this._originalSetter
    super.detach()
  }

  /**
   * Rotates the related mesh with an animation:
   * - records the action into the control manager
   * - runs the rotation animation until completion and updates the rotation angle
   * - applies gravity
   * - returns
   * Does nothing if the mesh is already being animated.
   *
   * @async
   */
  async rotate() {
    const {
      state: { duration, angle },
      isAnimated,
      mesh,
      frameRate,
      rotateAnimation,
      moveAnimation
    } = this
    if (isAnimated || !mesh) {
      return
    }
    logger.debug({ mesh }, `start rotating ${mesh.id}`)
    this.isAnimated = true

    controlManager.record({ mesh, fn: 'rotate' })

    const attach = detach(mesh)
    const to = mesh.position.clone()
    const rotation = 0.5 * Math.PI

    const lastFrame = Math.round(frameRate * (duration / 1000))
    rotateAnimation.setKeys([
      { frame: 0, value: angle },
      { frame: lastFrame, value: angle + rotation }
    ])
    moveAnimation.setKeys([
      { frame: 0, value: to },
      {
        frame: lastFrame * 0.5,
        value: new Vector3(to.x, to.y + 0.5, to.z)
      },
      { frame: lastFrame, value: to }
    ])
    // prevents interactions and collisions
    mesh.isPickable = false
    return new Promise(resolve =>
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
            updateAngle(this, rotation)
            mesh.rotation.y = this.state.angle
            logger.debug({ mesh }, `end rotating ${mesh.id}`)
            // framed animation may not exactly end where we want, so force the final position
            mesh.position.copyFrom(to)
            attach()
            applyGravity(mesh)
            mesh.isPickable = true
            this.isAnimated = false
            this.onAnimationEndObservable.notifyObservers()
            resolve()
          }
        )
    )
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {RotableState} state - state to update to.
   */
  fromState({ angle = 0, duration = 200 } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this.state = { angle, duration }
    this.mesh.rotation.y = this.state.angle
    this.mesh.computeWorldMatrix(true)
    if (!this.mesh.metadata) {
      this.mesh.metadata = {}
    }
    this.mesh.metadata.rotate = this.rotate.bind(this)
    this.mesh.metadata.angle = this.state.angle
  }
}

function updateAngle(behavior, rotation) {
  behavior.state.angle = (behavior.state.angle + rotation) % (2 * Math.PI)
  behavior.mesh.metadata.angle = behavior.state.angle
}

function detach(mesh) {
  let parent = mesh.parent
  mesh.setParent(null)

  const savedSetter = mesh.setParent.bind(mesh)
  mesh.setParent = newParent => {
    parent = newParent
  }

  return () => {
    mesh.setParent = savedSetter
    mesh.setParent(parent)
  }
}
