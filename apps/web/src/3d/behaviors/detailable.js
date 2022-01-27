import { DetailBehaviorName } from './names'
import { controlManager } from '../managers'

/**
 * @typedef {object} DetailableState behavior persistent state, including:
 * @property {string} frontImage - front image url.
 * @property {string} backImage - back image url.
 */

export class DetailBehavior {
  /**
   * Creates behavior to get details of a mesh.
   *
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {DetailableState} state - the behavior's current state.
   *
   * @param {DetailableState} state - behavior state.
   */
  constructor(state = {}) {
    this.mesh = null
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
   * @see {@link import('@babylonjs/core').Behavior.init}
   */
  init() {}

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - `front` null image
   * - `back` null image
   * - the `detail()` method.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
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
    controlManager.onDetailedObservable.notifyObservers({
      mesh: this.mesh,
      data: {
        image:
          this.state[
            this.mesh.metadata.isFlipped ? 'backImage' : 'frontImage'
          ] ?? null
      }
    })
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {DetailableState} state - state to update to.
   */
  fromState({ frontImage = null, backImage = null } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this.state = { frontImage, backImage }
    if (!this.mesh.metadata) {
      this.mesh.metadata = {}
    }
    this.mesh.metadata.detail = this.detail.bind(this)
    this.mesh.metadata.frontImage = this.state.frontImage
    this.mesh.metadata.backImage = this.state.backImage
  }
}
