// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@tabulous/server/src/graphql').FlippableState} FlippableState
 */

import { makeLogger } from '../../utils/logger'
import { controlManager } from '../managers/control'
import { actionNames } from '../utils/actions'
import {
  attachFunctions,
  attachProperty,
  detachFromParent,
  isMeshLocked,
  runAnimation
} from '../utils/behaviors'
import { applyGravity } from '../utils/gravity'
import { getDimensions } from '../utils/mesh'
import { AnimateBehavior } from './animatable'
import { FlipBehaviorName } from './names'

/** @typedef {FlippableState & Required<Pick<FlippableState, 'duration'>>} RequiredFlippableState */

const Tolerance = 0.000001

const logger = makeLogger(FlipBehaviorName)

export class FlipBehavior extends AnimateBehavior {
  /**
   * Creates behavior to make a mesh flippable with animation.
   * @param {FlippableState} state - behavior state.
   */
  constructor(state = {}) {
    super()
    /** @type {RequiredFlippableState} state - the behavior's current state. */
    this.state = /** @type {RequiredFlippableState} */ (state)
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
   * @param {Mesh} mesh - which becomes detailable.
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
   * @returns {Promise<void>}
   */
  async flip() {
    const {
      state: { duration, isFlipped },
      isAnimated,
      mesh,
      rotateAnimation,
      moveAnimation
    } = this
    if (isAnimated || !mesh || isMeshLocked(mesh)) {
      return
    }
    logger.debug({ mesh }, `start flipping ${mesh.id}`)

    controlManager.record({ mesh, fn: actionNames.flip, duration, args: [] })

    const attach = detachFromParent(mesh)
    const [x, y, z] = mesh.position.asArray()
    const { width } = getDimensions(mesh)

    this.state.isFlipped = !isFlipped
    let [pitch, yaw, roll] = mesh.rotation.asArray()
    // because of JS, yaw may be very close to Math.PI or 0, but not equal to it.
    const rotation =
      yaw < Math.PI - Tolerance && yaw >= -Tolerance ? Math.PI : -Math.PI
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
        animation: rotateAnimation,
        duration,
        keys: [
          { frame: 0, values: [pitch, yaw, roll] },
          { frame: 100, values: [pitch, yaw, roll + rotation] }
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
