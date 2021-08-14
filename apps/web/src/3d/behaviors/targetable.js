import { Observable } from '@babylonjs/core'
import { targetManager } from '../managers/target'

/**
 * @typedef {object} Target definition of a drop target:
 * TODO rename Zone, turn zone Mesh to a geometry and rename, and rename scale as extend.
 * @property {TargetBehavior} behavior - the enclosing targetable behavior.
 * @property {import('@babylonjs/core').Mesh} zone - invisible, unpickable mesh acting as drop zone.
 * @property {number} scale - units (in 3D coordinate) added to the zone's bounding box to determine.
 * @property {string[]} kinds - array of allowed drag kinds for this target.
 */

/**
 * @typedef {object} DropDetails detailed images definitions for a given mesh:
 * @property {import('@babylonjs/core').Mesh[]} dropped - a list of dropped meshes.
 * @property {Target} target - the target onto meshes are dropped.
 */

export class TargetBehavior {
  /**
   * Creates behavior to make a mesh targetable for drag operations, registered into the target manager.
   * A targetable mesh can have multiple targets, materialized with 3D geometries and each allowing one or several kinds.
   * All targets can be enable and disabled at once.
   * An observable emits every time one of the target receives a drop.
   *
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {boolean} enabled - activity status (true by default).
   * @property {Target[]} targets - defined targets for this mesh.
   * @property {Observable<DropDetails>} onDropObservable - emits every time draggable meshes are dropped to one of the targets
   *
   * @param {object} params - parameters, including:
   * @param {number} [params.moveDuration=100] - duration (in milliseconds) of an individual mesh shuffle animation.
   */
  constructor() {
    this.mesh = null
    this.enabled = true
    this.targets = []
    this.onDropObservable = new Observable()
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return TargetBehavior.NAME
  }

  /**
   * Does nothing.
   * @see {@link import('@babylonjs/core').Behavior.init}
   */
  init() {}

  /**
   * Attaches this behavior to a mesh, registering it to the target manager.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    if (!this.mesh) {
      this.mesh = mesh
      targetManager.registerTargetable(this)
    }
  }

  /**
   * Detaches this behavior from its mesh, disposing all its target zones,
   * and unregistering it from the target manager.
   */
  detach() {
    targetManager.unregisterTargetable(this)
    for (const { zone } of this.targets) {
      zone.dispose()
    }
    this.targets = []
    this.mesh = null
  }

  /**
   * Adds a new zone to this mesh, making it invisible and unpickable.
   * TODO rename addZone.
   * @param {import('@babylonjs/core').Mesh} zone - invisible, unpickable mesh acting as drop zone.
   * @param {number} scale - units (in 3D coordinate) added to the zone's bounding box to determine possible drops TODO rename.
   * @param {string[]} (kinds=[]) - array of allowed drag kinds for this target.
   */
  defineTarget(zone, scale, kinds = []) {
    zone.visibility = 0
    zone.isPickable = false
    this.targets.push({ zone, scale, kinds, behavior: this })
  }
}

/**
 * Name of all targetable behaviors.
 * @static
 * @memberof TargetBehavior
 * @type {string}
 */
TargetBehavior.NAME = 'targetable'
