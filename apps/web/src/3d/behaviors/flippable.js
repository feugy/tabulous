// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@tabulous/server/src/graphql').ActionName} ActionName
 * @typedef {import('@tabulous/server/src/graphql').FlippableState} FlippableState
 */

import { makeLogger } from '../../utils/logger'
import { actionNames } from '../utils/actions'
import {
  attachFunctions,
  attachProperty,
  detachFromParent,
  isMeshLocked,
  runAnimation
} from '../utils/behaviors'
import { applyGravity } from '../utils/gravity'
import { getDimensions, isAnimationInProgress } from '../utils/mesh'
import { AnimateBehavior } from './animatable'
import { FlipBehaviorName } from './names'

/** @typedef {FlippableState & Required<Pick<FlippableState, 'duration'>>} RequiredFlippableState */

const Tolerance = 0.000001

const logger = makeLogger(FlipBehaviorName)

export class FlipBehavior extends AnimateBehavior {
  /**
   * Creates behavior to make a mesh flippable with animation.
   * @param {FlippableState} state - behavior state.
   * @param {import('@src/3d/managers').Managers} managers - current managers.
   */
  constructor(state, managers) {
    super()
    /** @internal */
    this.managers = managers
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
   *
   * It observes other actions so it could flip this mesh when snapped to an anchor which requires it.
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
   */
  async flip() {
    await internalFlip(this)
  }

  /**
   * Revert flip actions. Ignores other actions
   * @param {ActionName} action - reverted action.
   */
  async revert(action) {
    if (action === actionNames.flip && this.mesh) {
      await internalFlip(this, true, true)
    }
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

async function internalFlip(
  /** @type {FlipBehavior} */ behavior,
  withGravity = true,
  isLocal = false
) {
  const {
    state: { duration },
    mesh,
    rotateAnimation,
    moveAnimation
  } = behavior
  if (!mesh || isMeshLocked(mesh) || isAnimationInProgress(mesh)) {
    return
  }
  logger.debug({ mesh }, `start flipping ${mesh.id}`)
  behavior.managers.control.record({
    mesh,
    fn: actionNames.flip,
    duration,
    args: [],
    isLocal
  })

  behavior.state.isFlipped = !behavior.state.isFlipped
  const attach = detachFromParent(mesh)
  const [x, y, z] = mesh.position.asArray()
  const { width } = getDimensions(mesh)

  let [pitch, yaw, roll] = mesh.rotation.asArray()
  // because of JS, yaw may be very close to Math.PI or 0, but not equal to it.
  const rotation =
    yaw < Math.PI - Tolerance && yaw >= -Tolerance ? Math.PI : -Math.PI
  return runAnimation(
    behavior,
    () => {
      // keep rotation between [0..2 * PI[, without modulo because it does not keep plain values
      if (mesh.rotation.z < 0) {
        mesh.rotation.z += 2 * Math.PI
      } else if (mesh.rotation.z >= 2 * Math.PI) {
        mesh.rotation.z -= 2 * Math.PI
      }
      attach()
      if (withGravity) {
        applyGravity(mesh)
      }
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
