import { moveManager } from '../managers/move'
import { attachProperty } from '../utils/behaviors'
import { AnimateBehavior } from './animatable'
import { MoveBehaviorName } from './names'

/**
 * @typedef {object} MovableState behavior persistent state, including:
 * @property {string} kind - drag kind, used to select targets.
 * @property {Point[]} partCenters? - when the mesh is made of several parts, a list of their centers.
 * @property {boolean} [snapDistance=0.25] - snap grid unit, in 3D world coordinate.
 * @property {number} [duration=100] - duration (in milliseconds) of the snap animation.
 */

/**
 * @typedef {object} Point a coordinate in space
 * @property {number} x? - horizontal coordinate.
 * @property {number} y? - vertical coordinate.
 * @property {number} z? - depth coordinate.
 */

export class MoveBehavior extends AnimateBehavior {
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
    super(state)
    this.state = state
    this.enabled = true
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return MoveBehaviorName
  }

  /**
   * Attaches this behavior to a mesh, registering it to the drag manager. Adds to the mesh metadata:
   * - `partCenters` property.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes movable.
   */
  attach(mesh) {
    super.attach(mesh)
    mesh.isPickable = true
    this.fromState(this.state)
    moveManager.registerMovable(this)
  }

  /**
   * Detaches this behavior from its mesh, by unregistering from the drag manager.
   */
  detach() {
    if (this.mesh) {
      this.mesh.isPickable = false
      moveManager.unregisterMovable(this)
    }
    super.detach()
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {MovableState} state - state to update to.
   */
  fromState({ kind, partCenters, snapDistance = 0.25, duration = 100 } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    attachProperty(this, 'partCenters', () => this.state.partCenters)
    this.state = { kind, snapDistance, duration, partCenters }
  }
}
