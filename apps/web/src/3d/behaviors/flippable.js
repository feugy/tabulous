import { Animation } from '@babylonjs/core/Animations/animation.js'

import { makeLogger } from '../../utils/logger'
import { controlManager } from '../managers/control'
import {
  attachFunctions,
  attachProperty,
  detachFromParent,
  runAnimation
} from '../utils/behaviors'
import { applyGravity } from '../utils/gravity'
import { getDimensions } from '../utils/mesh'
import { AnimateBehavior } from './animatable'
import { FlipBehaviorName } from './names'

const Tolerance = 0.000001

const logger = makeLogger(FlipBehaviorName)

/**
 * @typedef {object} FlippableState behavior persistent state, including:
 * @property {boolean} isFlipped - current flip status.
 * @property {number} [duration=500] - duration (in milliseconds) of the flip animation.
 */

export class FlipBehavior extends AnimateBehavior {
  /**
   * Creates behavior to make a mesh flippable with animation.
   *
   * @extends {AnimateBehavior}
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {FlippableState} state - the behavior's current state.
   *
   * @param {FlippableState} state - behavior state.
   */
  constructor(state = {}) {
    super(state)
    this.state = state
    // private
    this.flipAnimation = new Animation(
      'flip',
      'rotation.z',
      this.frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return FlipBehaviorName
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - the `isFlipped` property.
   * - the `flip()` method.
   * It initializes its rotation according to the flip status.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this.state)
  }

  /**
   * Flips the related mesh with an animation:
   * - records the action into the control manager
   * - runs the flip animation until completion and updates the flip status
   * - applies gravity
   * - returns
   * Does nothing if the mesh is already being animated.
   *
   * @async
   */
  async flip() {
    const {
      state: { duration, isFlipped },
      isAnimated,
      mesh,
      flipAnimation,
      moveAnimation
    } = this
    if (isAnimated || !mesh) {
      return
    }
    logger.debug({ mesh }, `start flipping ${mesh.id}`)

    controlManager.record({ mesh, fn: 'flip', duration })

    const attach = detachFromParent(mesh)
    const [x, y, z] = mesh.position.asArray()
    const { width } = getDimensions(mesh)

    this.state.isFlipped = !isFlipped
    // because of JS, rotation.y may be very close to Math.PI or 0, but not equal to it.
    const rotation =
      mesh.rotation.y < Math.PI - Tolerance && mesh.rotation.y >= -Tolerance
        ? Math.PI
        : -Math.PI
    await runAnimation(
      this,
      () => {
        // keep rotation between [0..2 * PI[, without modulo because it does not keep plain values
        if (mesh.rotation.z < 0) {
          mesh.rotation.z += 2 * Math.PI
        } else if (mesh.rotation.z >= 2 * Math.PI) {
          mesh.rotation.z -= 2 * Math.PI
        }
        attach()
        applyGravity(mesh)
        logger.debug({ mesh }, `end flipping ${mesh.id}`)
      },
      {
        animation: flipAnimation,
        duration,
        keys: [
          { frame: 0, values: [mesh.rotation.z] },
          { frame: 100, values: [mesh.rotation.z + rotation] }
        ]
      },
      {
        animation: moveAnimation,
        duration,
        keys: [
          { frame: 0, values: [x, y, z] },
          { frame: 50, values: [x, y + width, z] },
          { frame: 100, values: [x, y, z] }
        ]
      }
    )
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {FlippableState} state - state to update to.
   */
  fromState({ isFlipped = false, duration = 500 } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this.state = { isFlipped, duration }
    const attach = detachFromParent(this.mesh)
    this.mesh.rotation.z = this.state.isFlipped ? Math.PI : 0
    attach()
    attachFunctions(this, 'flip')
    attachProperty(this, 'isFlipped', () => this.state.isFlipped)
  }
}
