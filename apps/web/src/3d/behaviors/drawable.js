// @ts-check
import { Animation } from '@babylonjs/core/Animations/animation'

import { actionNames } from '../utils/actions'
import {
  attachFunctions,
  attachProperty,
  detachFromParent,
  runAnimation
} from '../utils/behaviors'
import { isAnimationInProgress } from '../utils/mesh'
import { AnimateBehavior } from './animatable'
import { DrawBehaviorName } from './names'

/** @typedef {Required<import('@tabulous/types').DrawableState>} RequiredDrawableState */

export class DrawBehavior extends AnimateBehavior {
  /**
   * Creates behavior to draw mesh from and to player's hand.
   * @param {import('@tabulous/types').DrawableState} state - behavior state.
   * @param {import('../managers').Managers} managers - current managers.
   */
  constructor(state, managers) {
    super()
    /** @internal */
    this.managers = managers
    /** the behavior's current state. */
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
   * - the `play()` method.
   * - the `drawable` getter.
   * - the `playable` getter.
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
   * Draws the related mesh with an animation into the player's hand:
   * - delegates draw to hand manager, who will call animateToHand().
   * @param {import('@tabulous/types').Mesh} [state] - when applying drawn from peers, state of the drawn mesh.
   * @param {string} [playerId] - the peer who drew mesh, if any.
   */
  async draw(state, playerId) {
    if (!this.mesh) return
    if (state && playerId) {
      await this.managers.hand.applyDraw(state, playerId)
    } else {
      await this.managers.hand.draw(this.mesh)
    }
  }

  /**
   * Plays the related mesh with an animation from the player's hand:
   * - delegates draw to hand manager, who will call animateToMain().
   */
  async play() {
    if (!this.mesh) return
    await this.managers.hand.play(this.mesh)
  }

  /**
   * Revert play actions. Ignores other actions.
   * @param {import('@tabulous/types').ActionName} action - reverted action.
   * @param {any[]} [args] - reverted arguments.
   */
  async revert(action, args = []) {
    if (this.mesh && args.length === 2) {
      const [state, playerId] = args
      if (action === actionNames.play) {
        await this.managers.hand.applyDraw(state, playerId)
      }
    }
  }

  /**
   * Runs the animation to move mesh from main scene to hand.
   */
  async animateToHand() {
    const {
      state: { duration },
      mesh,
      fadeAnimation,
      moveAnimation
    } = this
    if (!mesh || isAnimationInProgress(mesh)) {
      return
    }
    // eagerly set animationInProgress, because buildAnimationKeys will delay runAnimation
    mesh.animationInProgress = true
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
   */
  async animateToMain() {
    const {
      state: { duration },
      mesh,
      moveAnimation,
      fadeAnimation
    } = this
    if (!mesh || isAnimationInProgress(mesh)) {
      return
    }
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
   * @param {import('@tabulous/types').DrawableState} state - state to update to.
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
    attachFunctions(this, 'play')
    attachProperty(
      this,
      'drawable',
      () => this.mesh && !this.managers.hand.isManaging(this.mesh)
    )
    attachProperty(
      this,
      'playable',
      () => this.mesh && this.managers.hand.isManaging(this.mesh)
    )
  }
}

/**
 *
 * @param {import('@babylonjs/core').Mesh} mesh - animated mesh.
 * @param {boolean} [invert=false] - whether to invert or not.
 * @returns {Promise<{ fadeKeys: import('../utils').FloatKeyFrame[], moveKeys: import('../utils').Vector3KeyFrame[] }>} generated key frames.
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
