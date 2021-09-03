import { Animation } from '@babylonjs/core/Animations/animation'
import { applyGravity } from '../utils'

export class AnimateBehavior {
  /**
   * Creates behavior to make a mesh's position animatable.
   * It ignores any animations triggered while a previous animation is running.
   *
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {boolean} isAnimated - true when this mesh is being animated.
   * @property {number} frameRate - number of frames per second.
   *
   * @param {object} params - parameters, including:
   * @param {number} [params.frameRate=30] - number of frames per second.
   */
  constructor({ frameRate } = {}) {
    this.mesh = null
    this.isAnimated = false
    this.frameRate = frameRate || 30
    // private
    this.moveAnimation = new Animation(
      'move',
      'position',
      this.frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return AnimateBehavior.NAME
  }

  /**
   * Does nothing.
   * @see {@link import('@babylonjs/core').Behavior.init}
   */
  init() {}

  /**
   * Attaches this behavior to a mesh.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    if (!this.mesh) {
      this.mesh = mesh
    }
  }

  /**
   * Detaches this behavior from its mesh.
   */
  detach() {
    this.mesh = null
  }

  /**
   * Moves the related mesh with an animation:
   * - runs the move animation until completion
   * - applies gravity (if requested)
   * - returns
   * Does nothing if the mesh is already being animated.
   *
   * @async
   * @param {import('@babylonjs/core').Vector3} to - the desired new position.
   * @param {number} duration - move duration (in milliseconds).
   * @param {boolean} [gravity=true] - applies gravity at the end.
   */
  async moveTo(to, duration, gravity = true) {
    const { isAnimated, mesh, frameRate, moveAnimation } = this
    if (isAnimated) {
      return
    }
    this.isAnimated = true
    const from = mesh.absolutePosition.clone()

    const lastFrame = mesh.getScene().isLoading
      ? 1
      : Math.round(frameRate * (duration / 1000))
    moveAnimation.setKeys([
      { frame: 0, value: from },
      { frame: lastFrame, value: to }
    ])
    // prevents interactions and collisions
    mesh.isPickable = false
    return new Promise(resolve =>
      mesh
        .getScene()
        .beginDirectAnimation(
          mesh,
          [moveAnimation],
          0,
          lastFrame,
          false,
          1,
          () => {
            this.isAnimated = false
            // framed animation may not exactly end where we want, so force the final position
            mesh.setAbsolutePosition(to)
            if (gravity) {
              applyGravity(mesh)
            }
            mesh.isPickable = true
            resolve()
          }
        )
    )
  }
}

/**
 * Name of all movable behaviors.
 * @static
 * @memberof MoveBehavior
 * @type {string}
 */
AnimateBehavior.NAME = 'animatable'