// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@tabulous/server/src/graphql').MovableState} MovableState
 */

import { attachProperty } from '../utils/behaviors'
import { AnimateBehavior } from './animatable'
import { MoveBehaviorName } from './names'

/** @typedef {MovableState & Required<Pick<MovableState, 'duration'|'snapDistance'>>} RequiredMovableState */

export class MoveBehavior extends AnimateBehavior {
  /**
   * Creates behavior to make a mesh movable, and droppable over target zones.
   * When moving mesh, its final position will snap to a virtual grid.
   * A mesh can only be dropped onto zones with the same kind.
   * @param {MovableState} state - behavior state.
   * @param {import('@src/3d/managers').Managers} managers - current managers.
   */
  constructor(state, managers) {
    super()
    /** @internal */
    this.managers = managers
    /** @type {RequiredMovableState} state - the behavior's current state. */
    this.state = /** @type {RequiredMovableState} */ (state)
    /** @type {boolean} enabled - activity status (true by default). */
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
   * @param {Mesh} mesh - which becomes movable.
   */
  attach(mesh) {
    super.attach(mesh)
    mesh.isPickable = true
    this.fromState(this.state)
    this.managers.move.registerMovable(this)
  }

  /**
   * Detaches this behavior from its mesh, by unregistering from the drag manager.
   */
  detach() {
    if (this.mesh) {
      this.mesh.isPickable = false
      this.managers.move.unregisterMovable(this)
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
