import { Animation } from '@babylonjs/core/Animations/animation'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'

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
import { RandomBehaviorName } from './names'

const logger = makeLogger('randomizable')
const { cos, floor, PI, random, sin } = Math

/**
 * @typedef {object} RandomState behavior persistent state, including:
 * @property {number} [face = 1] - current face value.
 * @property {number} [duration = 600] - duration (in milliseconds) of the random animation. The set animartion is a third of it.
 * @property {boolean} [canBeSet = false] - whether this mesh can be manually set to a given fave.
 */

/**
 * @typedef {RandomState} RandomStateWithExtra behavior persistent state, with internal parameters provided by the mesh, including:
 * @property {number} max - maximum face value (minimum is always 1).
 * @property {Map<number, number[]} quaternionPerFace - map of Euler angles [x, y, z] applied when setting a given fave
 */

export class RandomBehavior extends AnimateBehavior {
  /**
   * Creates behavior to make a mesh randomizable: it has a face vaule and this face can be set, or randomly set.
   *
   * @extends {TargetBehavior}
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {RandomState} state - the behavior's current state (+ extras)
   *
   * @param {RandomStateWithExtra} state - behavior state.
   */
  constructor(state = {}) {
    super()
    this.state = state
    // private
    if (!(state.quaternionPerFace instanceof Map)) {
      throw new Error(`RandomBehavior needs quaternionPerFace`)
    }
    this.quaternionPerFace = state.quaternionPerFace
    if (!(state.max > 1)) {
      throw new Error(
        `RandomBehavior's max should be higher than ${state.face ?? 1}`
      )
    }
    this.max = state.max
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
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
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
   * @returns {Promise<void>}
   * @throws {Error} if desired face is not withing 1..max.
   */
  async setFace(face) {
    const {
      state: { face: oldFace, duration, canBeSet },
      max,
      quaternionPerFace,
      isAnimated,
      mesh,
      rollAnimation
    } = this
    if (isAnimated || !mesh || !canBeSet) {
      return
    }
    if (face < 1 || face > max) {
      throw new Error(
        `Can not set randomizable face for mesh ${mesh.id}: ${face} is not in [1..${max}]`
      )
    }
    await animate(this, 'setFace', face, duration / 3, {
      animation: rollAnimation,
      duration: duration / 3,
      keys: [
        {
          frame: 0,
          values: quaternionPerFace
            .get(oldFace)
            .multiply(quaternionPerFace.get(face).invert())
            .asArray()
        },
        { frame: 100, values: [0, 0, 0, 1] }
      ]
    })
  }

  /**
   * Randomly set the face value with an animation:
   * - records the action into the control manager
   * - updates the face
   * - runs the random animation until completion
   * - applies gravity
   * - returns
   * Does nothing if the mesh is already being animated.
   * @param {number} face? - final face value, used when applying random operation from peers
   * @returns {Promise<void>}
   */
  async random(face) {
    const {
      state: { face: oldFace, duration },
      isAnimated,
      max,
      quaternionPerFace,
      mesh,
      rollAnimation,
      moveAnimation
    } = this
    if (isAnimated || !mesh) {
      return
    }
    if (!face) {
      face = floor(random() * max + 1)
    }
    await animate(
      this,
      'random',
      face,
      duration,
      {
        animation: rollAnimation,
        duration,
        keys: [
          {
            frame: 0,
            values: quaternionPerFace
              .get(oldFace)
              .multiply(quaternionPerFace.get(face).invert())
              .asArray()
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
            values: makeRandomRotation('y', 0.5 * PI).asArray()
          }
        ]
      },
      {
        animation: moveAnimation,
        duration,
        keys: [
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
        ]
      }
    )
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {RandomState} state - state to update to.
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
    this.mesh.computeWorldMatrix(true)

    const restore = saveTranslation(this.mesh)
    this.save = {
      positions: this.mesh.getVerticesData(VertexBuffer.PositionKind),
      normals: this.mesh.getVerticesData(VertexBuffer.NormalKind)
    }
    this.mesh.markVerticesDataAsUpdatable(VertexBuffer.PositionKind, true)
    this.mesh.markVerticesDataAsUpdatable(VertexBuffer.NormalKind, true)
    restore()

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

function applyRotation({ mesh, quaternionPerFace, state: { face }, save }) {
  const restore = saveTranslation(mesh)
  mesh.updateVerticesData(VertexBuffer.PositionKind, [...save.positions])
  mesh.updateVerticesData(VertexBuffer.NormalKind, [...save.normals])
  mesh.rotationQuaternion = quaternionPerFace.get(face).clone()
  mesh.bakeCurrentTransformIntoVertices()
  mesh.refreshBoundingInfo()
  restore()
}

function saveTranslation(mesh) {
  const translation = mesh.absolutePosition.clone()
  mesh.setAbsolutePosition(Vector3.Zero())
  return () => {
    mesh.setAbsolutePosition(translation)
    translation
  }
}

async function animate(behavior, fn, face, duration, ...animations) {
  const {
    mesh,
    state: { face: oldFace }
  } = behavior
  logger.debug(
    { mesh, face, oldFace },
    `starts ${fn} on ${mesh.id} (${oldFace} > ${face})`
  )
  behavior.state.face = face
  controlManager.record({ mesh, fn, args: [face], duration })

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

function makeRandomRotation(axis, limit = 2 * PI) {
  const angle = random() * limit
  return new Quaternion(
    axis === 'x' ? sin(angle) : 0,
    axis === 'y' ? sin(angle) : 0,
    axis === 'z' ? sin(angle) : 0,
    cos(angle)
  )
}
