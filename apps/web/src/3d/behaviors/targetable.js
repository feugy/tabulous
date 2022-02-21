import { Observable } from '@babylonjs/core/Misc/observable'
import { TargetBehaviorName } from './names'
// '../managers' creates a cyclic dependency in Jest
import { targetManager } from '../managers/target'

/**
 * @typedef {object} DropZone definition of a target drop zone:
 * @property {TargetBehavior} targetable - the enclosing targetable behavior.
 * @property {import('@babylonjs/core').Mesh} mesh - invisible, unpickable mesh acting as drop zone.
 * @property {number} extend - units (in 3D coordinate) added to the zone's bounding box to determine.
 * @property {boolean} enabled - whether this zone is active or not.
 * @property {string[]} kinds? - an optional array of allowed drag kinds for this zone (allows all if not present).
 * @property {number} priority? - priority applied when multiple targets with same altitude apply.
 */

/**
 * @typedef {object} DropDetails detailed images definitions for a given mesh:
 * @property {import('@babylonjs/core').Mesh[]} dropped - a list of dropped meshes.
 * @property {DropZone} zone - the zone onto meshes are dropped.
 */

export class TargetBehavior {
  /**
   * Creates behavior to make a mesh targetable for drag operations, registered into the target manager.
   * A targetable mesh can have multiple drop zones, materialized with 3D geometries and each allowing one or several kinds.
   * All zones can be enable and disabled at once.
   * An observable emits every time one of the zone receives a drop.
   *
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {DropZone[]} zones - defined drop zones for this target.
   * @property {Observable<DropDetails>} onDropObservable - emits every time draggable meshes are dropped to one of the zones.
   *
   * @param {object} params - parameters, including:
   * @param {number} [params.moveDuration=100] - duration (in milliseconds) of an individual mesh re-order animation.
   */
  constructor() {
    this.mesh = null
    this.zones = []
    this.onDropObservable = new Observable()
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return TargetBehaviorName
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
    this.mesh = mesh
    targetManager.registerTargetable(this)
  }

  /**
   * Detaches this behavior from its mesh, disposing all its drop zones,
   * and unregistering it from the target manager.
   */
  detach() {
    targetManager.unregisterTargetable(this)
    for (const { mesh } of this.zones) {
      mesh.dispose(false, true)
    }
    this.zones = []
    this.mesh = null
  }

  /**
   * Adds a new zone to this mesh, making it invisible and unpickable.
   * @param {import('@babylonjs/core').Mesh} mesh - invisible, unpickable mesh acting as drop zone.
   * @param {number} extent - units (in 3D coordinate) added to the zone's bounding box to determine possible drops.
   * @param {string[]} kinds? - an optional array of allowed drag kinds for this zone.
   * @param {boolean} [enabled=true] - enables this zone.
   * @param {number} [priority=0] - priority for this zone.
   * @returns {DropZone} the created zone.
   */
  addZone(mesh, extent, kinds, enabled = true, priority = 0) {
    mesh.visibility = 0
    mesh.isPickable = false
    const zone = { mesh, extent, kinds, enabled, targetable: this, priority }
    this.zones.push(zone)
    return zone
  }

  /**
   * Removes an existing zone, disposing its mesh.
   * Does nothing if no zone is bound to the given mesh id
   * @param {DropZone} zone - removed zone mesh.
   */
  removeZone(zone) {
    const idx = this.zones.indexOf(zone)
    if (idx >= 0) {
      const [{ mesh }] = this.zones.splice(idx, 1)
      mesh.dispose(false, true)
    }
  }
}
