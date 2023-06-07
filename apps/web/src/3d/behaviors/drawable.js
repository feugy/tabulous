import { Animation } from '@babylonjs/core/Animations/animation'

import { handManager } from '../managers/hand'
import {
  attachFunctions,
  detachFromParent,
  runAnimation
} from '../utils/behaviors'
import { AnimateBehavior } from './animatable'
import { DrawBehaviorName } from './names'

/**
 * @typedef {object} DrawableState behavior persistent state, including:
 * @property {boolean} [unflipOnPick=true] - unflip flipped mesh when picking them in hand.
 * @property {boolean} [flipOnPlay=false] - flip flipable meshes when playing them from hand.
 * @property {number} [angleOnPick=0] - set angle of rotable meshes when picking them in hand.
 * @property {number} [duration=750] - duration (in milliseconds) of the draw animation.
 */

export class DrawBehavior extends AnimateBehavior {
  /**
   * Creates behavior to draw mesh from and to player's hand.
   *
   * @extends {AnimateBehavior}
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {DrawableState} state - the behavior's current state.
   *
   * @param {DrawableState} state - behavior state.
   */
  constructor(state = {}) {
    super(state)
    this.state = state
    // private
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
   * @see {@link import('@babylonjs/core').Behavior.init}
   */
  init() {}

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - the `draw()` method.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes drawable.
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
   * @async
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
   * @async
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

async function buildAnimationKeys(mesh, invert = false) {
  // delay so that all observer of onAction to perform: we need the mesh to be have not parents before getting its position
  await Promise.resolve()
  const { x, y, z } = mesh.position
  return {
    fadeKeys: [
      {
        frame: invert ? 100 : 0,
        values: [1, null, -0.0000758616630226917, null]
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
