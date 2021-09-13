import { moveManager } from '../managers'

/**
 * @typedef {object} MovableState behavior persistent state, including:
 * @property {string} kind - drag kind, used to select targets.
 * @property {boolean} [snapDistance=0.25] - snap grid unit, in 3D world coordinate.
 * @property {number} [duration=100] - duration (in milliseconds) of the snap animation.
 */

export class MoveBehavior {
  /**
   * Creates behavior to make a mesh movable, and droppable over target zones.
   * When moving mesh, its final position will snap to a virtual grid.
   * A mesh can only be dropped onto zones with the same kind.
   *
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {boolean} enabled - activity status (true by default).
   * @property {MovableState} state - the behavior's current state.
   *
   * @param {MovableState} state - behavior state.
   */
  constructor(state = {}) {
    this.mesh = null
    this.state = state
    this.enabled = true
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return MoveBehavior.NAME
  }

  /**
   * Does nothing.
   * @see {@link import('@babylonjs/core').Behavior.init}
   */
  init() {}

  /**
   * Attaches this behavior to a mesh, registering it to the drag manager
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    this.mesh = mesh
    this.fromState(this.state)
    moveManager.registerMovable(this)
  }

  /**
   * Detaches this behavior from its mesh, by unregistering from the drag manager.
   */
  detach() {
    moveManager.unregisterMovable(this)
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
      snapDistance: state.snapDistance || 0.25,
      duration: state.duration || 100
    }
  }
}

/**
 * Name of all draggable behaviors.
 * @static
 * @memberof MoveBehavior
 * @type {string}
 */
MoveBehavior.NAME = 'movable'
