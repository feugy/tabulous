import { Observable } from '@babylonjs/core/Misc/observable'
import { targetManager } from '../managers'

/**
 * @typedef {object} DropZone definition of a target drop zone:
 * @property {TargetBehavior} targetable - the enclosing targetable behavior.
 * @property {import('@babylonjs/core').Mesh} mesh - invisible, unpickable mesh acting as drop zone.
 * @property {number} extend - units (in 3D coordinate) added to the zone's bounding box to determine.
 * @property {string[]} kinds - array of allowed drag kinds for this zone.
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
   * @property {boolean} enabled - activity status (true by default).
   * @property {DropZone[]} zones - defined drop zones for this target.
   * @property {Observable<DropDetails>} onDropObservable - emits every time draggable meshes are dropped to one of the zones.
   *
   * @param {object} params - parameters, including:
   * @param {number} [params.moveDuration=100] - duration (in milliseconds) of an individual mesh re-order animation.
   */
  constructor() {
    this.mesh = null
    this.enabled = true
    this.zones = []
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
   * Detaches this behavior from its mesh, disposing all its drop zones,
   * and unregistering it from the target manager.
   */
  detach() {
    targetManager.unregisterTargetable(this)
    for (const { mesh } of this.zones) {
      mesh.dispose()
    }
    this.zones = []
    this.mesh = null
  }

  /**
   * Adds a new zone to this mesh, making it invisible and unpickable.
   * @param {import('@babylonjs/core').Mesh} mesh - invisible, unpickable mesh acting as drop zone.
   * @param {number} extent - units (in 3D coordinate) added to the zone's bounding box to determine possible drops.
   * @param {string[]} (kinds=[]) - array of allowed drag kinds for this zone.
   */
  addZone(mesh, extent, kinds = []) {
    mesh.visibility = 0
    mesh.isPickable = false
    this.zones.push({ mesh, extent, kinds, targetable: this })
  }
}

/**
 * Name of all targetable behaviors.
 * @static
 * @memberof TargetBehavior
 * @type {string}
 */
TargetBehavior.NAME = 'targetable'
