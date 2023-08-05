// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@tabulous/server/src/graphql').Anchor} Anchor
 * @typedef {import('@tabulous/server/src/graphql').Targetable} Targetable
 * @typedef {import('@src/3d/managers/target').SingleDropZone} SingleDropZone
 * @typedef {import('@src/3d/managers/target').DropZone} DropZone
 */

import { Observable } from '@babylonjs/core/Misc/observable.js'

import { indicatorManager } from '../managers/indicator'
import { targetManager } from '../managers/target'
import { TargetBehaviorName } from './names'

/** @typedef {Targetable & Required<Pick<Targetable, 'extent'>> & Pick<Anchor, 'playerId'|'ignoreParts'|'angle'>} ZoneProps properties of a drop zone */

/**
 * @typedef {object} DropDetails detailed images definitions for a given mesh:
 * @property {Mesh[]} dropped - a list of dropped meshes.
 * @property {DropZone} zone - the zone onto meshes are dropped.
 * @property {boolean} [immediate=false] - when true, no animation should be ran.
 */

export class TargetBehavior {
  /**
   * Creates behavior to make a mesh targetable for drag operations, registered into the target manager.
   * A targetable mesh can have multiple drop zones, materialized with 3D geometries and each allowing one or several kinds.
   * All zones can be enable and disabled at once.
   * An observable emits every time one of the zone receives a drop.
   * @param {object} params - parameters, including:
   * @param {number} [params.moveDuration=100] - duration (in milliseconds) of an individual mesh re-order animation.
   */
  constructor() {
    /** @type {?Mesh} mesh - the related mesh. */
    this.mesh = null
    /** @type {SingleDropZone[]} defined drop zones for this target. */
    this.zones = []
    /** @type {Observable<DropDetails>} emits every time draggable meshes are dropped to one of the zones.*/
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
   * @see https://doc.babylonjs.com/typedoc/interfaces/babylon.behavior#init
   */
  init() {}

  /**
   * Attaches this behavior to a mesh, registering it to the target manager.
   * @param {Mesh} mesh - which becomes detailable.
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
      mesh.dispose()
    }
    this.zones = []
    this.mesh = null
  }

  /**
   * Adds a new zone to this mesh, making it invisible and unpickable.
   * By default, zone is enabled, accepts all kind, with a priority of 0, and no playerId.
   * @param {Mesh} mesh - invisible, unpickable mesh acting as drop zone.
   * @param {ZoneProps} properties - drop zone properties.
   * @returns {SingleDropZone} the created zone.
   */
  addZone(mesh, properties) {
    mesh.visibility = 0
    mesh.isPickable = false
    mesh.isHittable = false
    mesh.scalingDeterminant = 1.01
    /** @type {SingleDropZone} */
    const zone = {
      mesh,
      targetable: this,
      ...properties,
      ignoreParts: properties.ignoreParts ?? false,
      enabled: properties.enabled ?? true,
      priority: properties.priority ?? 0
    }
    if (properties.playerId) {
      const id = `${properties.playerId}.drop-zone.${mesh.id}`
      indicatorManager.registerMeshIndicator({
        id,
        mesh,
        playerId: properties.playerId
      })
    }
    this.zones.push(zone)
    return zone
  }

  /**
   * Removes an existing zone, disposing its mesh.
   * Does nothing if no zone is bound to the given mesh id
   * @param {SingleDropZone} zone - removed zone mesh.
   */
  removeZone(zone) {
    const idx = this.zones.indexOf(zone)
    if (idx >= 0) {
      const [{ mesh }] = this.zones.splice(idx, 1)
      mesh.dispose()
    }
  }
}
