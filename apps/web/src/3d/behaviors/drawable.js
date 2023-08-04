// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@tabulous/server/src/graphql/types').DrawableState} DrawableState
 * @typedef {import('@src/3d/utils').FloatKeyFrame} FloatKeyFrame
 * @typedef {import('@src/3d/utils').Vector3KeyFrame} Vector3KeyFrame
 */

import { Animation } from '@babylonjs/core/Animations/animation'

import { handManager } from '../managers/hand'
import {
  attachFunctions,
  detachFromParent,
  runAnimation
} from '../utils/behaviors'
import { AnimateBehavior } from './animatable'
import { DrawBehaviorName } from './names'

/** @typedef {Required<DrawableState>} RequiredDrawableState */

export class DrawBehavior extends AnimateBehavior {
  /**
   * Creates behavior to draw mesh from and to player's hand.
   * @param {DrawableState} state - behavior state.
   */
  constructor(state = {}) {
    super()
    /** @type {RequiredDrawableState} state - the behavior's current state. */
    this.state = /** @type {RequiredDrawableState} */ (state)
    /** @protected @type {Animation} */
    this.fadeAnimation = new Animation(
      'draw',
      'visibility',
      this.frameRate,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CONSTANT
    )
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return DrawBehaviorName
  }

  /**
   * Does nothing.
   * @see https://doc.babylonjs.com/typedoc/interfaces/babylon.behavior#init
   */
  init() {}

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - the `draw()` method.
   * @param {Mesh} mesh - which becomes drawable.
   */
  attach(mesh) {
    this.mesh = mesh
    this.fromState(this.state)
  }

  /**
   * Detaches this behavior from its mesh.
   */
  detach() {
    this.mesh = null
  }

  /**
   * Draws the related mesh with an animation into and from the player's hand:
   * - delegates draw to hand manager, who will call animateToHand() or animateToMain() accordingly
   */
  draw() {
    if (!this.mesh) return
    handManager.draw(this.mesh)
  }

  /**
   * Runs the animation to move mesh from main scene to hand.
   * @returns {Promise<void>}
   */
  async animateToHand() {
    const {
      state: { duration },
      mesh,
      isAnimated,
      fadeAnimation,
      moveAnimation
    } = this
    if (isAnimated || !mesh) {
      return
    }
    this.isAnimated = true
    const attach = detachFromParent(mesh)
    const { fadeKeys, moveKeys } = await buildAnimationKeys(mesh)
    await runAnimation(
      this,
      () => attach(),
      { animation: fadeAnimation, keys: fadeKeys, duration },
      { animation: moveAnimation, keys: moveKeys, duration }
    )
  }

  /**
   * Runs the animation to move mesh from hand to main scene
   * @returns {Promise<void>}
   */
  async animateToMain() {
    const {
      state: { duration },
      mesh,
      isAnimated,
      moveAnimation,
      fadeAnimation
    } = this
    if (isAnimated || !mesh) {
      return
    }
    this.isAnimated = true
    const attach = detachFromParent(mesh)
    const { moveKeys, fadeKeys } = await buildAnimationKeys(mesh, true)
    await runAnimation(
      this,
      () => attach(),
      { animation: fadeAnimation, duration, keys: fadeKeys },
      { animation: moveAnimation, duration, keys: moveKeys }
    )
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {DrawableState} state - state to update to.
   */
  fromState({
    duration = 750,
    unflipOnPick = true,
    flipOnPlay = false,
    angleOnPick = 0
  } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this.state = { duration, unflipOnPick, flipOnPlay, angleOnPick }
    attachFunctions(this, 'draw')
  }
}

/**
 *
 * @param {Mesh} mesh - animated mesh.
 * @param {boolean} [invert=false] - whether to invert or not.
 * @returns {Promise<{ fadeKeys: FloatKeyFrame[], moveKeys: Vector3KeyFrame[] }>} generated key frames.
 */
async function buildAnimationKeys(mesh, invert = false) {
  // delay so that all observer of onAction to perform: we need the mesh to be have not parents before getting its position
  await Promise.resolve()
  const { x, y, z } = mesh.position
  return {
    fadeKeys: [
      {
        frame: invert ? 100 : 0,
        values: [1, null, -0.0000758616630226917]
      },
      {
        frame: invert ? 80 : 20,
        values: [1, -0.0003360034286126166, -0.000336003428612619]
      },
      { frame: invert ? 0 : 100, values: [0, -0.0001442270546882745, 0] }
    ],
    moveKeys: [
      {
        frame: invert ? 100 : 0,
        values: [x, y, z, [0, 0, 0], [0, 0, -0.000268358058537076]]
      },
      {
        frame: invert ? 77 : 33,
        values: [
          x,
          y + 2.3625105868381526,
          z,
          [0.000548475079160796, 0.021056004034022635, 0],
          [0.000548475079160796, 0.02105600207773054, 0]
        ]
      },
      {
        frame: invert ? 0 : 100,
        values: [x, y + 3, z, [0, 0, 0], [0, 0, 0]]
      }
    ]
  }
}
