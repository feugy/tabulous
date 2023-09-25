// @ts-check
/**
 * @typedef {import('@babylonjs/core').Axis} Axis
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@tabulous/server/src/graphql').ActionName} ActionName
 * @typedef {import('@tabulous/server/src/graphql').RandomizableState} RandomizableState
 * @typedef {import('@src/3d/utils').AnimationSpec} AnimationSpec
 * @typedef {import('@src/3d/utils').QuaternionKeyFrame} QuaternionKeyFrame
 * @typedef {import('@src/3d/utils').Vector3KeyFrame} Vector3KeyFrame
 */

import { Animation } from '@babylonjs/core/Animations/animation'
import { Quaternion } from '@babylonjs/core/Maths/math.vector'

import { makeLogger } from '../../utils/logger'
import { actionNames } from '../utils/actions'
import {
  attachFunctions,
  attachProperty,
  detachFromParent,
  runAnimation
} from '../utils/behaviors'
import { applyGravity } from '../utils/gravity'
import { getDimensions, isAnimationInProgress } from '../utils/mesh'
import { AnimateBehavior } from './animatable'
import { RandomBehaviorName } from './names'

const logger = makeLogger('randomizable')
const { cos, floor, PI, random, sin } = Math

/**
 * @typedef {object} Extras behavior persistent state, with internal parameters provided by the mesh.
 * @property {number} max - maximum face value (minimum is always 1).
 * @property {Map<number, Quaternion>} quaternionPerFace - map of Euler angles [x, y, z] applied when setting a given fave
 *
 * @typedef {RandomizableState & Required<Pick<RandomizableState, 'face'|'duration'|'canBeSet'>>} RequiredRandomizableState
 */

export class RandomBehavior extends AnimateBehavior {
  /**
   * Creates behavior to make a mesh randomizable: it has a face vaule and this face can be set, or randomly set.
   * @param {RandomizableState & Extras} stateWithExtra - behavior persistent state, with internal parameters provided by the mesh.
   * @param {import('@src/3d/managers').Managers} managers - current managers.
   */
  constructor(stateWithExtra, managers) {
    super()
    /** @internal */
    this.managers = managers
    /** @type {RequiredRandomizableState} state - the behavior's current state (+ extras) */
    this.state = /** @type {RequiredRandomizableState} */ (stateWithExtra)
    if (!(stateWithExtra.quaternionPerFace instanceof Map)) {
      throw new Error(`RandomBehavior needs quaternionPerFace`)
    }
    /** @type {number} */
    this.max = stateWithExtra.max
    /** @internal @type {Map<number, Quaternion>} */
    this.quaternionPerFace = stateWithExtra.quaternionPerFace
    if (!(this.max > 1)) {
      throw new Error(
        `RandomBehavior's max should be higher than ${this.state.face ?? 1}`
      )
    }
    /** @internal @type {Animation} */
    this.rollAnimation = new Animation(
      'roll',
      'rotationQuaternion',
      this.frameRate,
      Animation.ANIMATIONTYPE_QUATERNION,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return RandomBehaviorName
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - a `face` number (minimum 1).
   * - a `maxFace` number.
   * - a `random()` function to randomly set a new face value.
   * - a `setFace()` function to set the face to a given value.
   * @param {Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this.state)
  }

  /**
   * Set the face value with an animation:
   * - records the action into the control manager
   * - updates the face
   * - runs the set animation until completion
   * - applies gravity
   * - returns
   * Does nothing if the mesh is already being animated, or can not be set.
   * @param {number} face - desired face value.
   * @throws {Error} if desired face is not withing 1..max.
   */
  async setFace(face) {
    const {
      state: { canBeSet },
      max,
      mesh
    } = this
    if (!mesh || !canBeSet || isAnimationInProgress(mesh)) {
      return
    }
    if (face < 1 || face > max) {
      throw new Error(
        `Can not set randomizable face for mesh ${mesh.id}: ${face} is not in [1..${max}]`
      )
    }
    await internalSetFace(this, face)
  }

  /**
   * Randomly set the face value with an animation:
   * - records the action into the control manager
   * - updates the face
   * - runs the random animation until completion
   * - applies gravity
   * - returns
   * Does nothing if the mesh is already being animated.
   * @param {number} [face] - final face value, used when applying random operation from peers
   */
  async random(face) {
    if (!face) {
      face = floor(random() * this.max + 1)
    }
    await internalRandom(this, face)
  }

  /**
   * Revert setFace and random actions. Ignores other actions
   * @param {ActionName} action - reverted action.
   * @param {any[]} [args] - reverted arguments.
   */
  async revert(action, args = []) {
    if (!this.mesh || args.length !== 1) {
      return
    }
    if (action === actionNames.random) {
      await internalRandom(this, args[0], true)
    } else if (action === actionNames.setFace) {
      await internalSetFace(this, args[0], true)
    }
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {RandomizableState} state - state to update to.
   */
  fromState({ face = 1, duration = 600, canBeSet = false } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this.state = { face, duration, canBeSet }
    if (this.max < face) {
      throw new Error(
        `Can not restore state face ${face} since maximum is ${this.max}`
      )
    }
    const attach = detachFromParent(this.mesh)
    applyRotation(this)
    attach()
    attachFunctions(this, 'random')
    if (canBeSet) {
      attachFunctions(this, 'setFace')
    } else {
      this.mesh.metadata.setFace = undefined
    }
    attachProperty(this, 'face', () => this.state.face)
    attachProperty(this, 'maxFace', () => this.max)
  }
}

function internalRandom(
  /** @type {RandomBehavior} */ behavior,
  /** @type {number} */ face,
  isLocal = false
) {
  const {
    state: { duration },
    quaternionPerFace,
    mesh,
    rollAnimation,
    moveAnimation
  } = behavior
  if (!mesh || isAnimationInProgress(mesh)) {
    return
  }
  return animate(
    behavior,
    isLocal,
    'random',
    face,
    duration,
    {
      animation: rollAnimation,
      duration,
      keys: /** @type {QuaternionKeyFrame[]} */ ([
        {
          frame: 0,
          values: mesh.rotationQuaternion?.asArray()
        },
        {
          frame: 25,
          values: makeRandomRotation('x')
            .multiply(makeRandomRotation('z'))
            .asArray()
        },
        {
          frame: 50,
          values: makeRandomRotation('z')
            .multiply(makeRandomRotation('y'))
            .asArray()
        },
        {
          frame: 75,
          values: makeRandomRotation('y')
            .multiply(makeRandomRotation('x'))
            .asArray()
        },
        {
          frame: 100,
          values: quaternionPerFace.get(face)?.asArray()
        }
      ])
    },
    {
      animation: moveAnimation,
      duration,
      keys: /** @type {Vector3KeyFrame[]} */ ([
        { frame: 0, values: mesh.position.asArray() },
        {
          frame: 50,
          values: [
            mesh.position.x,
            mesh.position.y + getDimensions(mesh).height * 2,
            mesh.position.z
          ]
        },
        { frame: 100, values: mesh.position.asArray() }
      ])
    }
  )
}

function internalSetFace(
  /** @type {RandomBehavior} */ behavior,
  /** @type {number} */ face,
  isLocal = false
) {
  const {
    state: { duration },
    quaternionPerFace,
    mesh,
    rollAnimation
  } = behavior
  if (!mesh || isAnimationInProgress(mesh)) {
    return
  }
  return animate(behavior, isLocal, 'setFace', face, duration / 3, {
    animation: rollAnimation,
    duration: duration / 3,
    keys: /** @type {QuaternionKeyFrame[]} */ ([
      {
        frame: 0,
        values: mesh.rotationQuaternion?.asArray()
      },
      { frame: 100, values: quaternionPerFace.get(face)?.asArray() }
    ])
  })
}

function applyRotation(
  /** @type {RandomBehavior} */ { mesh, quaternionPerFace, state: { face } }
) {
  if (!mesh) return
  mesh.rotationQuaternion =
    quaternionPerFace.get(face ?? 1)?.clone() ?? Quaternion.Identity()
}

/**
 * @param {RandomBehavior} behavior - animated behavior.
 * @param {boolean} isLocal - action locality.
 * @param {ActionName} fn - function name, for logging.
 * @param {number} face - face to animate to.
 * @param {number|undefined} duration - animation duration.
 * @param  {...AnimationSpec} animations - animation spec used.
 * @returns resolves when animation is completed.
 */
async function animate(behavior, isLocal, fn, face, duration, ...animations) {
  const {
    mesh,
    state: { face: oldFace }
  } = behavior
  if (!mesh) return

  logger.debug(
    { mesh, face, oldFace },
    `starts ${fn} on ${mesh.id} (${oldFace} > ${face})`
  )
  behavior.managers.control.record({
    mesh,
    fn,
    args: [face],
    duration,
    revert: [oldFace],
    isLocal
  })

  behavior.state.face = face
  const attach = detachFromParent(mesh)
  applyRotation(behavior)

  await runAnimation(
    behavior,
    () => {
      attach()
      logger.debug(
        { mesh, value: face },
        `ends ${fn} on ${mesh.id} with face ${face}`
      )
      return applyGravity(mesh)
    },
    ...animations
  )
}

/**
 * Builds a random quaterion on a given axis.
 * @param {Axis} axis - concerned mesh.
 * @param {number} [limit] - maximum rotation allowed.
 */
function makeRandomRotation(axis, limit = 2 * PI) {
  const angle = random() * limit
  return new Quaternion(
    axis === 'x' ? sin(angle) : 0,
    axis === 'y' ? sin(angle) : 0,
    axis === 'z' ? sin(angle) : 0,
    cos(angle)
  )
}
