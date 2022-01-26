import { Color3 } from '@babylonjs/core/Maths/math.color'
import { selectionManager } from '.'
import { getTargetableBehavior, isAbove } from '../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('target')

class TargetManager {
  /**
   * Creates a manager to manages drop targets for draggable meshes:
   * - find relevant zones physically bellow a given mesh, according to their kind
   * - highlight zones
   * - drop mesh onto their relevant zones
   * Each registered behavior can have multiple zones
   */
  constructor() {
    // private
    this.behaviors = new Set()
    this.droppablesByDropZone = new Map()
  }

  /**
   * Registers a new targetable behavior.
   * Does nothing if this behavior is already managed.
   * @param {import('../behaviors').TargetBehavior} behavior - targetable behavior.
   */
  registerTargetable(behavior) {
    if (behavior?.mesh) {
      this.behaviors.add(behavior)
    }
  }

  /**
   * Unregisters a targetable behavior, clearing all its zones.
   * Does nothing on unmanaged behavior.
   * @param {import('../behaviors').TargetBehavior} behavior - controlled behavior.
   */
  unregisterTargetable(behavior) {
    this.behaviors.delete(behavior)
    for (const zone of behavior?.zones ?? []) {
      this.clear(zone)
    }
  }

  /**
   * @param {import('@babylonjs/core').Mesh} mesh - tested mesh.
   * @returns {boolean} whether this mesh's target behavior is controlled or not
   */
  isManaging(mesh) {
    return this.behaviors.has(getTargetableBehavior(mesh))
  }

  /**
   * Finds drop zones physically bellow a given mesh.
   * Only enabled zones accepting the dragged, kind will match.
   * In case several zones are bellow the mesh, and the one on top will prevail (according to its elevation).
   * The found zone is highlithed, and the dragged mesh will be saved as potential droppable for this zone.
   *
   * @param {import('@babylonjs/core').Mesh} dragged - a dragged mesh.
   * @param {string} kind - drag kind.
   * @return {import('../behaviors').DropZone} the found drop zone, if any.
   */
  findDropZone(dragged, kind) {
    logger.debug(
      { dragged, kind, b: this.behaviors },
      `find drop zones for ${dragged?.id} (${kind})`
    )
    const candidates = []
    const excluded = [dragged, ...selectionManager.meshes]
    for (const targetable of this.behaviors) {
      if (!excluded.includes(targetable.mesh)) {
        for (const zone of targetable.zones) {
          const { enabled, mesh, extent, kinds, priority } = zone
          if (
            enabled &&
            (!kinds || kinds.includes(kind)) &&
            isAbove(dragged, mesh, extent)
          ) {
            candidates.push({
              targetable,
              zone,
              priority,
              y: zone.mesh.absolutePosition.y
            })
          }
        }
      }
    }
    logger.debug(
      { dragged, kind, candidates },
      `${candidates.length} candidate(s) found`
    )
    if (candidates.length > 0) {
      candidates.sort((a, b) =>
        b.y === a.y ? b.priority - a.priority : b.y - a.y
      )
      const [{ targetable, zone }] = candidates
      logger.info(
        { zone, dragged, kind },
        `found drop zone ${targetable.mesh?.id} for ${dragged?.id} (${kind})`
      )
      const droppables = this.droppablesByDropZone.get(zone) ?? []
      this.droppablesByDropZone.set(zone, [...droppables, dragged])
      if (zone?.mesh?.visibility === 0) {
        zone.mesh.visibility = 0.1
        zone.mesh.enableEdgesRendering()
        zone.mesh.edgesWidth = 5.0
        zone.mesh.edgesColor = Color3.Green().toColor4()
      }
      return zone
    }
  }

  /**
   * Clears all droppable meshes of a given drop zone, and stops highlighting it.
   * @param {import('../behaviors').DropZone} zone - the cleared drop zone.
   */
  clear(zone) {
    this.droppablesByDropZone.delete(zone)
    if (zone?.mesh) {
      zone.mesh.visibility = 0
      zone.mesh.disableEdgesRendering()
    }
  }

  /**
   * If the provided target as droppable meshes, performs a drop operation, that is,
   * notifying drop observers of the corresponding Targetable behavior.
   * It clears the target.
   * @param {import('../behaviors').DropZone} zone - the zone dropped onto.
   * @returns {import('@babylonjs/core').Mesh[]} list of droppable meshes, if any.
   */
  dropOn(zone) {
    const dropped = this.droppablesByDropZone.get(zone) ?? []
    if (dropped.length) {
      logger.info(
        { zone, dragged: dropped },
        `performs drop over mesh ${zone.targetable.mesh?.id} for ${dropped.map(
          ({ id }) => id
        )}`
      )
      zone.targetable.onDropObservable.notifyObservers({ dropped, zone })
    }
    this.clear(zone)
    return dropped
  }
}

/**
 * Mesh drop target manager singleton.
 * @type {TargetManager}
 */
export const targetManager = new TargetManager()
