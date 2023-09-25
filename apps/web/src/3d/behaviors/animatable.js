// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Vector3} Vector3
 * @typedef {import('@src/3d/utils').Vector3KeyFrame} Vector3KeyFrame
 */

import { Animation } from '@babylonjs/core/Animations/animation'

import { runAnimation } from '../utils/behaviors'
import { applyGravity } from '../utils/gravity'
import { isAnimationInProgress } from '../utils/mesh'
import { convertToLocal } from '../utils/vector'
import { AnimateBehaviorName } from './names'

export class AnimateBehavior {
  /**
   * Creates behavior to make a mesh's position animatable.
   * It ignores any animations triggered while a previous animation is running.
   * @param {object} params - parameters, including:
   * @param {number} [params.frameRate=60] - number of frames per second.
   */
  constructor({ frameRate } = {}) {
    /** @type {?Mesh} mesh - the related mesh. */
    this.mesh = null
    /** @type {number} frameRate - number of frames per second. */
    this.frameRate = frameRate ?? 60
    /** @type {Animation} */
    this.moveAnimation = new Animation(
      'move',
      'position',
      this.frameRate,
      Animation.ANIMATIONTYPE_VECTOR3,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
    /** @type {Animation} */
    this.rotateAnimation = new Animation(
      'rotate',
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
    return AnimateBehaviorName
  }

  /**
   * Does nothing.
   * @see https://doc.babylonjs.com/typedoc/interfaces/babylon.behavior#init
   */
  init() {}

  /**
   * Attaches this behavior to a mesh.
   * @param {Mesh} mesh - which becomes detailable.
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
   * @param {Vector3} to - the desired new absolute position.
   * @param {?Vector3} rotation - its final rotation (set to null to leave unmodified).
   * @param {number} duration - move duration (in milliseconds).
   * @param {boolean} [gravity=true] - applies gravity at the end.
   */
  async moveTo(to, rotation, duration, gravity = true) {
    const { mesh, moveAnimation, rotateAnimation } = this
    if (!mesh || isAnimationInProgress(mesh)) {
      return
    }
    const frameSpecs = [
      {
        animation: moveAnimation,
        duration: mesh.getEngine().isLoading ? 0 : duration,
        keys: /** @type {Vector3KeyFrame[]} */ ([
          {
            frame: 0,
            values: convertToLocal(mesh.absolutePosition, mesh).asArray()
          },
          { frame: 100, values: convertToLocal(to, mesh).asArray() }
        ])
      }
    ]
    if (rotation) {
      frameSpecs.push({
        animation: rotateAnimation,
        duration: mesh.getEngine().isLoading ? 0 : duration,
        keys: /** @type {Vector3KeyFrame[]} */ ([
          { frame: 0, values: mesh.rotation.asArray() },
          { frame: 100, values: rotation.asArray() }
        ])
      })
    }
    await runAnimation(
      this,
      () => {
        if (gravity) {
          applyGravity(mesh)
        }
      },
      ...frameSpecs
    )
  }
}
