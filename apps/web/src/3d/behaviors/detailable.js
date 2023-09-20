// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@tabulous/server/src/graphql').DetailableState} DetailableState
 * @typedef {import('../utils').ScreenPosition} ScreenPosition
 */

import {
  attachFunctions,
  attachProperty,
  selectDetailedFace
} from '../utils/behaviors'
import { getMeshScreenPosition } from '../utils/vector'
import { DetailBehaviorName, StackBehaviorName } from './names'

export class DetailBehavior {
  /**
   * Creates behavior to get details of a mesh.
   * @param {DetailableState} state - behavior state.
   * @param {import('@src/3d/managers').Managers} managers - current managers.
   */
  constructor(state, managers) {
    /** @internal */
    this.managers = managers
    /** @type {?Mesh} mesh - the related mesh. */
    this.mesh = null
    /**  @type {DetailableState} state - the behavior's current state. */
    this.state = state
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return DetailBehaviorName
  }

  /**
   * Does nothing.
   * @see https://doc.babylonjs.com/typedoc/interfaces/babylon.behavior#init
   */
  init() {}

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - `frontImage` property.
   * - `backImage` property.
   * - the `detail()` method.
   * @param {Mesh} mesh - which becomes detailable.
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
   * If attached, sends the mesh details to control manager, so they could be displayed.
   */
  detail() {
    if (!this.mesh) return
    const stackable = this.mesh.getBehaviorByName(StackBehaviorName)
    this.managers.control.onDetailedObservable.notifyObservers({
      position: /** @type {ScreenPosition} */ (
        getMeshScreenPosition(this.mesh)
      ),
      images: /** @type {string[]} */ (
        (stackable?.stack ?? [this.mesh])
          .map(selectDetailedFace)
          .reverse()
          .filter(Boolean)
      )
    })
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {DetailableState} state - state to update to.
   */
  fromState({ frontImage = '', backImage }) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this.state = { frontImage, backImage }
    attachFunctions(this, 'detail')
    attachProperty(this, 'frontImage', () => this.state.frontImage)
    attachProperty(this, 'backImage', () => this.state.backImage)
  }
}
