import { Animation } from '@babylonjs/core/Animations/animation.js'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

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

/**
 * @typedef {object} RandomState behavior persistent state, including:
 * @property {number} [face = 1] - current face value.
 * @property {number} [duration = 600] - duration (in milliseconds) of the random animation. The set animartion is a third of it.
 * @property {boolean} [canBeSet = false] - whether this mesh can be manually set to a given fave.
 */

/**
 * @typedef {RandomState} RandomStateWithExtra behavior persistent state, with internal parameters provided by the mesh, including:
 * @property {number} max - maximum face value (minimum is always 1).
 * @property {Map<number, number[]} rotationPerFace - map of Euler angles [x, y, z] applied when setting a given fave
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
    this.max = state.max
    this.rotationPerFace = state.rotationPerFace
    this.rollAnimation = new Animation(
      'roll',
      'rotation',
      this.frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
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
      rotationPerFace,
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
    logger.debug(
      { mesh, face, oldFace },
      `start setting ${mesh.id} (${oldFace} > ${face})`
    )
    this.state.face = face
    controlManager.record({
      mesh,
      fn: 'setFace',
      args: [face],
      duration: duration / 3
    })

    const attach = detachFromParent(mesh)
    applyRotation(this)

    const [oldX, oldY, oldZ] = rotationPerFace.get(oldFace)
    const [x, y, z] = rotationPerFace.get(face)

    await runAnimation(
      this,
      () => {
        attach()
        logger.debug({ mesh, face }, `end setting ${mesh.id} to face ${face}`)
        return applyGravity(mesh)
      },
      {
        animation: rollAnimation,
        duration: duration / 3,
        keys: [
          { frame: 0, values: [oldX - x, oldY - y, oldZ - z] },
          { frame: 100, values: [0, 0, 0] }
        ]
      }
    )
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
      rotationPerFace,
      mesh,
      rollAnimation,
      moveAnimation
    } = this
    if (isAnimated || !mesh) {
      return
    }
    if (!face) {
      face = Math.floor(Math.random() * max + 1)
    }
    logger.debug(
      { mesh, face, oldFace },
      `start randomizing ${mesh.id} (${oldFace} > ${face})`
    )
    this.state.face = face
    controlManager.record({ mesh, fn: 'random', args: [face], duration })

    const attach = detachFromParent(mesh)
    applyRotation(this)

    const [oldX, oldY, oldZ] = rotationPerFace.get(oldFace)
    const [x, y, z] = rotationPerFace.get(face)
    await runAnimation(
      this,
      () => {
        mesh.rotation.x = mesh.rotation.x % (2 * Math.PI)
        attach()
        logger.debug(
          { mesh, value: face },
          `end randomizing ${mesh.id} to face ${face}`
        )
        return applyGravity(mesh)
      },
      {
        animation: rollAnimation,
        duration,
        keys: [
          { frame: 0, values: [oldX - x, oldY - y, oldZ - z] },
          { frame: 50, values: [Math.random() * 2 * Math.PI, 0, 0] },
          { frame: 100, values: [0, Math.random() * 2 * Math.PI, 0] }
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
  fromState({ value: face = 1, duration = 600, canBeSet = false } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this.state = { face, duration, canBeSet }
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
    }
    attachProperty(this, 'face', () => this.state.face)
    attachProperty(this, 'maxFace', () => this.max)
  }
}

function applyRotation({ mesh, rotationPerFace, state: { face }, save }) {
  const restore = saveTranslation(mesh)
  mesh.updateVerticesData(VertexBuffer.PositionKind, [...save.positions])
  mesh.updateVerticesData(VertexBuffer.NormalKind, [...save.normals])
  mesh.rotation = new Vector3(...rotationPerFace.get(face))
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
