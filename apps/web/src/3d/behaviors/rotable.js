// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@tabulous/server/src/graphql').ActionName} ActionName
 * @typedef {import('@tabulous/server/src/graphql').RotableState} RotableState
 * @typedef {import('@src/3d/utils').Vector3KeyFrame} Vector3KeyFrame
 */

import { Vector3 } from '@babylonjs/core/Maths/math'

import { makeLogger } from '../../utils/logger'
import { controlManager } from '../managers/control'
import { actionNames } from '../utils/actions'
import {
  attachFunctions,
  attachProperty,
  isMeshLocked,
  runAnimation
} from '../utils/behaviors'
import { applyGravity } from '../utils/gravity'
import { isAnimationInProgress } from '../utils/mesh'
import { convertToLocal, getAbsoluteRotation } from '../utils/vector'
import { AnimateBehavior } from './animatable'
import { RotateBehaviorName } from './names'

/** @typedef {RotableState & Required<Pick<RotableState, 'duration'>>} RequiredRotableState */

const logger = makeLogger('rotable')

const rotationStep = Math.PI * 0.5

export class RotateBehavior extends AnimateBehavior {
  /**
   * Creates behavior to make a mesh rotable with animation.
   * It will add to this mesh's metadata:
   * - a `rotate()` function to rotate by 45°.
   * - a rotation `angle` (in radian).
   * @param {RotableState} state - behavior state.
   */
  constructor(state = {}) {
    super()
    this._state = /** @type {RequiredRotableState} */ (state)
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return RotateBehaviorName
  }

  /**
   * @property {RequiredRotableState} state - this behavior's current state.
   */
  get state() {
    const angle = this.mesh
      ? getAbsoluteRotation(this.mesh).y
      : this._state.angle
    return { duration: this._state.duration, angle }
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - the `angle` property.
   * - the `rotate()` method.
   * It initializes its rotation according to angle.
   * When attaching/detaching this mesh to a parent, adjust rotation angle
   * according to the parent's own rotation, so that rotating the parent
   * will accordingly rotate the child.
   * @param {Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this._state)
  }

  /**
   * Rotates the related mesh with an animation:
   * - records the action into the control manager
   * - runs the rotation animation until completion and updates the rotation angle
   * - applies gravity
   * - returns
   * Does nothing if the mesh is already being animated.
   *
   * @param {number} [angle] - new rotation angle. When not set, adds PI/2 to the current rotation.
   */
  async rotate(angle) {
    await internalRotate(this, angle)
  }

  /**
   * Revert rotate actions. Ignores other actions
   * @param {ActionName} action - reverted action.
   * @param {any[]} [args] - reverted arguments.
   */
  async revert(action, args = []) {
    if (action === actionNames.rotate && this.mesh) {
      await internalRotate(this, args[0], true)
    }
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
    attachFunctions(this, 'rotate')
    attachProperty(this, 'angle', () => this.state.angle)
  }
}

async function internalRotate(
  /** @type {RotateBehavior} */ behavior,
  /** @type {number|undefined} */ angle,
  isLocal = false
) {
  const {
    _state: { duration },
    mesh,
    rotateAnimation,
    moveAnimation
  } = behavior
  if (!mesh || isMeshLocked(mesh) || isAnimationInProgress(mesh)) {
    return
  }
  logger.debug({ mesh }, `start rotating ${mesh.id}`)

  const [x, y, z] = mesh.position.asArray()
  const [pitch, yaw, roll] = mesh.rotation.asArray()

  let rotation = angle ?? yaw + rotationStep
  if (mesh.parent && getAbsoluteRotation(mesh.parent).z >= Math.PI) {
    rotation *= -1
  }

  controlManager.record({
    mesh,
    fn: actionNames.rotate,
    args: [rotation],
    duration,
    revert: [yaw],
    isLocal
  })

  await runAnimation(
    behavior,
    () => {
      applyGravity(mesh)
      mesh.rotation.y = mesh.rotation.y % (2 * Math.PI)
      logger.debug({ mesh }, `end rotating ${mesh.id}`)
    },
    {
      animation: rotateAnimation,
      duration,
      keys: [
        { frame: 0, values: [pitch, yaw, roll] },
        { frame: 100, values: [pitch, rotation, roll] }
      ]
    },
    {
      animation: moveAnimation,
      duration,
      keys: /** @type {Vector3KeyFrame[]} */ ([
        { frame: 0, values: [x, y, z] },
        {
          frame: 50,
          values: convertToLocal(
            mesh.absolutePosition.add(new Vector3(0, 0.5, 0)),
            mesh
          ).asArray()
        },
        { frame: 100, values: [x, y, z] }
      ])
    }
  )
}
