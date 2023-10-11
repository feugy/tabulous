// @ts-check
import { Observable } from '@babylonjs/core/Misc/observable.js'

import { TargetBehaviorName } from './names'

/** @typedef {Required<Pick<import('@tabulous/types').Anchor, 'extent'>> & Pick<import('@tabulous/types').Anchor, 'kinds'|'priority'|'enabled'|'playerId'|'ignoreParts'|'angle'|'max'>} ZoneProps properties of a drop zone */

export class TargetBehavior {
  /**
   * Creates behavior to make a mesh targetable for drag operations, registered into the target manager.
   * A targetable mesh can have multiple drop zones, materialized with 3D geometries and each allowing one or several kinds.
   * All zones can be enable and disabled at once.
   * An observable emits every time one of the zone receives a drop.
   * @param {object} state - unused state.
   * @param {import('../managers').Managers} managers - current managers.
   */
  constructor(state, managers) {
    /** @type {?import('@babylonjs/core').Mesh} mesh - the related mesh. */
    this.mesh = null
    /** @type {import('../managers').SingleDropZone[]} defined drop zones for this target. */
    this.zones = []
    /** @type {Observable<import('../managers').DropDetails>} emits every time draggable meshes are dropped to one of the zones.*/
    this.onDropObservable = new Observable()
    /** @internal */
    this.managers = managers
  }

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
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    this.mesh = mesh
    this.managers.target.registerTargetable(this)
  }

  /**
   * Detaches this behavior from its mesh, disposing all its drop zones,
   * and unregistering it from the target manager.
   */
  detach() {
    this.managers.target.unregisterTargetable(this)
    for (const { mesh } of this.zones) {
      mesh.dispose()
    }
    this.zones = []
    this.mesh = null
  }

  /**
   * Adds a new zone to this mesh, making it invisible and unpickable.
   * By default, zone is enabled, accepts all kind, with a priority of 0, and no playerId.
   * @param {import('@babylonjs/core').Mesh} mesh - invisible, unpickable mesh acting as drop zone.
   * @param {ZoneProps} properties - drop zone properties.
   * @returns the created zone.
   */
  addZone(mesh, properties) {
    mesh.visibility = 0
    mesh.isPickable = false
    mesh.isHittable = false
    mesh.isDropZone = true
    mesh.scalingDeterminant = 1.01
    /** @type {import('../managers').SingleDropZone} */
    const zone = {
      mesh,
      targetable: this,
      ...properties,
      ignoreParts: properties.ignoreParts ?? false,
      enabled: properties.enabled ?? true,
      priority: properties.priority ?? 0,
      max: properties.max ?? 1
    }
    if (properties.playerId) {
      const id = `${properties.playerId}.drop-zone.${mesh.id}`
      this.managers.indicator.registerMeshIndicator({
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
   * @param {import('../managers').SingleDropZone} zone - removed zone mesh.
   */
  removeZone(zone) {
    const idx = this.zones.indexOf(zone)
    if (idx >= 0) {
      const [{ mesh }] = this.zones.splice(idx, 1)
      mesh.dispose()
    }
  }
}
