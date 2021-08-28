import { Animation, Vector3 } from '@babylonjs/core'
import { AnimateBehavior } from './animatable'
import { applyGravity } from '../utils'
import { controlManager } from '../managers'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('flippable')

export class FlipBehavior extends AnimateBehavior {
  /**
   * Creates behavior to make a mesh flippable with animation.
   *
   * @extends {AnimateBehavior}
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {boolean} isFlipped - true when this mesh is flipped.
   * @property {number} duration - duration (in milliseconds) of the flip animation.
   *
   * @param {object} params - parameters, including:
   * @param {boolean} [params.isFlipped=false] - true to flip this mesh, initially.
   * @param {number} [params.duration=500] - duration (in milliseconds) of the flip animation.
   */
  constructor(params) {
    super(params)
    this.isFlipped = params.isFlipped || false
    this.duration = params.duration || 500
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
    mesh.rotation.z = this.isFlipped ? Math.PI : 0
    if (!mesh.metadata) {
      mesh.metadata = {}
    }
    mesh.metadata.flip = this.flip.bind(this)
    mesh.metadata.isFlipped = this.isFlipped
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
      duration,
      isAnimated,
      isFlipped,
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
      { frame: 0, value: isFlipped ? Math.PI : 0 },
      { frame: lastFrame, value: isFlipped ? 0 : Math.PI }
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
            this.isFlipped = !isFlipped
            mesh.metadata.isFlipped = this.isFlipped
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
   * @typedef {object} FlippableState behavior persistent state, including:
   * @property {boolean} isFlipped - current flip status.
   */

  /**
   * Gets this behavior's state.
   * @returns {FlippableState} this behavior's state for serialization.
   */
  serialize() {
    return { isFlipped: this.isFlipped }
  }
}

/**
 * Name of all flippable behaviors.
 * @static
 * @memberof FlipBehavior
 * @type {string}
 */
FlipBehavior.NAME = 'flippable'
