import { Animation } from '@babylonjs/core/Animations/animation.js'
import { Observable } from '@babylonjs/core/Misc/observable.js'
import { AnimateBehaviorName } from './names'
import { runAnimation } from '../utils/behaviors'
import { applyGravity } from '../utils/gravity'
import { convertToLocal } from '../utils/vector'

export class AnimateBehavior {
  /**
   * Creates behavior to make a mesh's position animatable.
   * It ignores any animations triggered while a previous animation is running.
   *
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {boolean} isAnimated - true when this mesh is being animated.
   * @property {number} frameRate - number of frames per second.
   * @property {Observable} onAnimationEndObservable - emits when animation has ended.
   *
   * @param {object} params - parameters, including:
   * @param {number} [params.frameRate=60] - number of frames per second.
   */
  constructor({ frameRate } = {}) {
    this.mesh = null
    this.isAnimated = false
    this.frameRate = frameRate ?? 60
    this.onAnimationEndObservable = new Observable()
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
    return AnimateBehaviorName
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
    this.mesh = mesh
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
   * @param {import('@babylonjs/core').Vector3} to - the desired new absolute position.
   * @param {number} duration - move duration (in milliseconds).
   * @param {boolean} [gravity=true] - applies gravity at the end.
   */
  async moveTo(to, duration, gravity = true) {
    const { isAnimated, mesh, moveAnimation } = this
    if (isAnimated || !mesh) {
      return
    }
    await runAnimation(
      this,
      () => {
        if (gravity) {
          applyGravity(mesh)
        }
      },
      {
        animation: moveAnimation,
        duration: mesh.getEngine().isLoading ? 0 : duration,
        keys: [
          {
            frame: 0,
            values: convertToLocal(mesh.absolutePosition, mesh).asArray()
          },
          { frame: 100, values: convertToLocal(to, mesh).asArray() }
        ]
      }
    )
  }
}
