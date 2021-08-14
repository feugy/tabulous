import { Color3 } from '@babylonjs/core'
import { isAbove } from '../utils'
import { selectionManager } from './selection'
import { makeLogger } from '../../utils'

const logger = makeLogger('target')

class TargetManager {
  /**
   * Creates a manager to manages drop targets for draggable meshes:
   * - find relevant targets physically bellow a given mesh, according to their kind
   * - highlight targets
   * - drop mesh onto their relevant target
   * Each registered behavior can have multiple targets
   */
  constructor() {
    // private
    this.behaviors = new Set()
    this.droppablesByTarget = new Map()
  }

  /**
   * Registers a new targetable behavior.
   * Does nothing if this behavior is already managed.
   * @param {Targetable} behavior - targetable behavior.
   */
  registerTargetable(behavior) {
    this.behaviors.add(behavior)
  }

  /**
   * Unregisters a targetable behavior, clearing all its targets.
   * Does nothing on unmanaged behavior.
   * @param {Targetable} behavior - controlled behavior.
   */
  unregisterTargetable(behavior) {
    this.behaviors.delete(behavior)
    for (const target of behavior?.targets ?? []) {
      this.clear(target)
    }
  }

  /**
   * Finds targets physically bellow a given mesh.
   * Only targets accepting the dragged kind will match.
   * In case several targets are bellow the mesh, and the one on top will prevail (according to its elevation).
   * The found target is highlithed, and the dragged mesh will be saved as potential droppable for this target.
   *
   * @param {import('@babylonjs/core').Mesh} dragged - a dragged mesh.
   * @param {string} kind - drag kind.
   * @return {import('../behaviors').Target} the found target, if any.
   */
  findTarget(dragged, kind) {
    logger.debug(
      { dragged, kind, b: this.behaviors },
      `find targets for ${dragged?.id} (${kind})`
    )
    const candidates = []
    const excluded = [dragged, ...selectionManager.meshes]
    for (const behavior of this.behaviors) {
      if (behavior.enabled && !excluded.includes(behavior.mesh)) {
        for (const target of behavior.targets) {
          const { zone, scale, kinds } = target
          if (kinds.includes(kind) && isAbove(dragged, zone, scale)) {
            candidates.push({
              behavior,
              target,
              y: behavior.mesh.absolutePosition.y
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
      candidates.sort((a, b) => b.y - a.y)
      const [{ target, behavior }] = candidates
      logger.info(
        { target, dragged, kind },
        `found drop target ${behavior.mesh?.id} for ${dragged?.id} (${kind})`
      )
      const droppables = this.droppablesByTarget.get(target) ?? []
      this.droppablesByTarget.set(target, [...droppables, dragged])
      if (target?.zone?.visibility === 0) {
        target.zone.visibility = 0.1
        target.zone.enableEdgesRendering()
        target.zone.edgesWidth = 5.0
        target.zone.edgesColor = Color3.Green().toColor4()
      }
      return target
    }
  }

  /**
   * Clears all droppable meshes of a given target, and stops highlighting it.
   * @param {import('../behaviors').Target} target - the cleared target.
   */
  clear(target) {
    this.droppablesByTarget.delete(target)
    if (target?.zone) {
      target.zone.visibility = 0
      target.zone.disableEdgesRendering()
    }
  }

  /**
   * If the provided target as droppable meshes, performs a drop operation, that is,
   * notifying drop observers of the corresponding Targetable behavior.
   * It clears the target.
   * @param {import('../behaviors').Target} target - the darget dropped onto.
   * @returns {import('@babylonjs/core').Mesh[]} list of droppable meshes, if any.
   */
  dropOn(target) {
    const dropped = this.droppablesByTarget.get(target) ?? []
    if (dropped.length) {
      logger.info(
        { target, dragged: dropped },
        `performs drop over mesh ${target.behavior.mesh?.id} for ${dropped.map(
          ({ id }) => id
        )}`
      )
      target.behavior.onDropObservable.notifyObservers({ dropped, target })
    }
    this.clear(target)
    return dropped
  }
}

/**
 * Mesh drop target manager singleton.
 * @type {TargetManager}
 */
export const targetManager = new TargetManager()
