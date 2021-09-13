import { Animation } from '@babylonjs/core/Animations/animation'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { AnimateBehavior } from './animatable'
import { applyGravity } from '../utils'
import { controlManager } from '../managers'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('flippable')

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
    return FlipBehavior.NAME
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
      frameRate,
      flipAnimation,
      moveAnimation
    } = this
    if (isAnimated) {
      return
    }
    logger.debug({ mesh }, `start flipping ${mesh.id}`)
    this.isAnimated = true

    controlManager.record({ meshId: mesh.id, fn: 'flip' })

    const to = mesh.absolutePosition.clone()
    const [min, max] = mesh.getBoundingInfo().boundingBox.vectorsWorld
    const width = Math.abs(min.x - max.x)

    const lastFrame = Math.round(frameRate * (duration / 1000))
    flipAnimation.setKeys([
      { frame: 0, value: mesh.rotation.z },
      {
        frame: lastFrame,
        value:
          mesh.rotation.z + (mesh.rotation.y < Math.PI ? Math.PI : -Math.PI)
      }
    ])
    moveAnimation.setKeys([
      { frame: 0, value: to },
      {
        frame: lastFrame * 0.5,
        value: new Vector3(to.x, to.y + width, to.z)
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
          [flipAnimation, moveAnimation],
          0,
          lastFrame,
          false,
          1,
          () => {
            this.isAnimated = false
            this.state.isFlipped = !isFlipped
            mesh.metadata.isFlipped = this.state.isFlipped
            // keep rotation between [0..2 * PI[, without modulo because it does not keep plain values
            if (mesh.rotation.z < 0) {
              mesh.rotation.z += 2 * Math.PI
            } else if (mesh.rotation.z >= 2 * Math.PI) {
              mesh.rotation.z -= 2 * Math.PI
            }
            logger.debug({ mesh }, `end flipping ${mesh.id}`)
            // framed animation may not exactly end where we want, so force the final position
            mesh.setAbsolutePosition(to)
            applyGravity(mesh)
            mesh.isPickable = true
            resolve()
          }
        )
    )
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {FlippableState} state - state to update to.
   */
  fromState(state = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    // since graphQL returns nulls, we can not use default values
    this.state = {
      ...state,
      isFlipped: state.isFlipped || false,
      duration: state.duration || 500
    }
    if ('isFlipped' in this.state) {
      this.mesh.rotation.z = this.state.isFlipped ? Math.PI : 0
      if (!this.mesh.metadata) {
        this.mesh.metadata = {}
      }
      this.mesh.metadata.flip = this.flip.bind(this)
      this.mesh.metadata.isFlipped = this.state.isFlipped
    }
  }
}

/**
 * Name of all flippable behaviors.
 * @static
 * @memberof FlipBehavior
 * @type {string}
 */
FlipBehavior.NAME = 'flippable'
