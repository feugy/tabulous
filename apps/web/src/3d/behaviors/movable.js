import { moveManager } from '../managers'

export class MoveBehavior {
  /**
   * Creates behavior to make a mesh movable, and droppable over target zones.
   * When moving mesh, its final position will snap to a virtual grid.
   * A mesh can only be dropped onto zones with the same kind.
   *
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {string} dragKind - drag kind.
   * @property {number} snapDistance - snap grid unit, in 3D world coordinate.
   * @property {number} moveDuration - duration (in milliseconds) of the snap move.
   *
   * @param {object} params - parameters, including:
   * @param {number} params.snapDistance - snap grid unit, in 3D world coordinate.
   * @param {number} params.moveDuration - duration (in milliseconds) of the snap move.
   * @param {string} params.dragKind - drag kind.
   */
  constructor({ moveDuration, snapDistance, dragKind } = {}) {
    this.mesh = null
    this.dragKind = dragKind
    this.snapDistance = snapDistance || 0.25
    this.moveDuration = moveDuration || 100
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
    moveManager.registerMovable(this)
  }

  /**
   * Detaches this behavior from its mesh, by unregistering from the drag manager.
   */
  detach() {
    moveManager.unregisterMovable(this)
  }
}

/**
 * Name of all draggable behaviors.
 * @static
 * @memberof MoveBehavior
 * @type {string}
 */
MoveBehavior.NAME = 'movable'
