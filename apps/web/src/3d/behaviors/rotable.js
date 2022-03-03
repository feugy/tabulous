import { Animation } from '@babylonjs/core/Animations/animation'
import { AnimateBehavior } from './animatable'
import { RotateBehaviorName } from './names'
import {
  applyGravity,
  attachProperty,
  getAbsoluteRotation,
  runAnimation
} from '../utils'
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
    this._state = state
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
   * Gets this behavior's state.
   * @returns {RotableState} this behavior's state for serialization.
   */
  get state() {
    return {
      duration: this._state.duration,
      angle: this.mesh ? getAbsoluteRotation(this.mesh).y : this._state.angle
    }
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
    this.fromState(this._state)
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
      _state: { duration },
      isAnimated,
      mesh,
      rotateAnimation,
      moveAnimation
    } = this
    if (isAnimated || !mesh) {
      return
    }
    logger.debug({ mesh }, `start rotating ${mesh.id}`)
    this.isAnimated = true

    controlManager.record({ mesh, fn: 'rotate' })

    const [x, y, z] = mesh.position.asArray()
    const [, yaw] = mesh.rotation.asArray()

    await runAnimation(
      this,
      () => {
        applyGravity(mesh)
        mesh.rotation.y = mesh.rotation.y % (2 * Math.PI)
        logger.debug({ mesh }, `end rotating ${mesh.id}`)
      },
      {
        animation: rotateAnimation,
        duration,
        keys: [
          { frame: 0, values: [yaw] },
          { frame: 100, values: [yaw + 0.5 * Math.PI] }
        ]
      },
      {
        animation: moveAnimation,
        duration,
        keys: [
          { frame: 0, values: [x, y, z] },
          { frame: 50, values: [x, y + 0.5, z] },
          { frame: 100, values: [x, y, z] }
        ]
      }
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
    this._state = { duration }
    const { parent } = this.mesh
    this.mesh.setParent(null)
    this.mesh.rotation.y = angle
    this.mesh.setParent(parent)
    if (!this.mesh.metadata) {
      this.mesh.metadata = {}
    }
    this.mesh.metadata.rotate = this.rotate.bind(this)
    attachProperty(this.mesh.metadata, 'angle', () => this.state.angle)
  }
}
