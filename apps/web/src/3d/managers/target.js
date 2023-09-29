// @ts-check
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'

import { makeLogger } from '../../utils/logger'
import { distance } from '../../utils/math'
import {
  getMeshAbsolutePartCenters,
  getTargetableBehavior
} from '../utils/behaviors'
import { isAbove } from '../utils/gravity'

const logger = makeLogger('target')

/**
 * @typedef {object} DropDetails detailed images definitions for a given mesh:
 * @property {import('@babylonjs/core').Mesh[]} dropped - a list of dropped meshes.
 * @property {import('.').DropZone} zone - the zone onto meshes are dropped.
 * @property {boolean} [immediate=false] - when true, no animation should be ran.dropped.
 * @property {boolean} [isLocal=false] - set action locality.
 */

/**
 * @typedef {object} _SingleDropZone definition of a target drop zone
 * @property {import('../behaviors').TargetBehavior} targetable - the enclosing targetable behavior.
 * @property {import('@babylonjs/core').Mesh} mesh - invisible, unpickable mesh acting as drop zone.
 *
 * @typedef {Record<string, ?> & Omit<import('@tabulous/types').Anchor, 'id'|'snappedId'|'angle'|'flip'> &
 * Required<Pick<import('@tabulous/types').Anchor, 'ignoreParts'|'enabled'|'extent'|'priority'>> &
 * _SingleDropZone} SingleDropZone definition of a target drop zone
 */

/**
 * @typedef {object} MultiDropZone a virtual drop zone made of several other zones
 * @property {SingleDropZone[]} parts - a list of part for this zone.
 * @property {import('../behaviors').TargetBehavior} targetable - targetable of the first part.
 * @property {import('@babylonjs/core').Mesh} mesh - mesh of the first part.
 */

/** @typedef {SingleDropZone|MultiDropZone} DropZone */

/** @typedef {{ zone: SingleDropZone, distance: number }} Candidate */

export class TargetManager {
  /**
   * Creates a manager to manages drop targets for draggable meshes:
   * - find relevant zones physically bellow a given mesh, according to their kind
   * - highlight zones
   * - drop mesh onto their relevant zones
   * Each registered behavior can have multiple zones
   * Invokes init() before any other function.
   *
   * @param {object} params - parameters, including:
   * @param {import('@babylonjs/core').Scene} params.scene - main scene.
   */
  constructor({ scene }) {
    /** the main scene. */
    this.scene = scene
    /** @type {string} current player Id. */
    this.playerId
    /** @type {Color4} current player color. */
    this.color
    /** @internal @type {Set<import('../behaviors').TargetBehavior>} set of managed behaviors. */
    this.behaviors = new Set()
    /** @internal @type {Map<DropZone, import('@babylonjs/core').Mesh[]>} map of droppable meshes by drop zone.*/
    this.droppablesByDropZone = new Map()
    /** @internal @type {StandardMaterial} material applied to active drop zones. */
    this.material
    /** @internal @type {import('.').Managers} */
    this.managers
  }

  /**
   * Initialize with game data.
   * @param {object} params - parameters, including:
   * @param {import('.').Managers} params.managers - other managers.
   * @param {string} params.playerId - current player Id.
   * @param {string} params.color - hexadecimal color string used for highlighting targets.
   */
  init({ managers, playerId, color }) {
    this.managers = managers
    this.playerId = playerId
    /** current player color. */
    this.color = Color4.FromHexString(color)
    this.material = new StandardMaterial('target-material', this.scene)
    this.material.diffuseColor = Color3.FromArray(this.color.asArray())
    this.material.alpha = 0.5
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
   * @returns whether this mesh's target behavior is controlled or not
   */
  isManaging(mesh) {
    const behavior = getTargetableBehavior(mesh)
    return behavior ? this.behaviors.has(behavior) : false
  }

  /**
   * Finds drop zones for a given player id and specified kind.
   * In case several zones are valid, the one with highest priority, or with highest elevation, will prevail.
   * The found zone is highlithed, and the dragged mesh will be saved as potential droppable for this zone.
   *
   * @param {import('@babylonjs/core').Mesh} dragged - a dragged mesh.
   * @param {string} [kind] - drag kind.
   * @returns matching zone, if any.
   */
  findPlayerZone(dragged, kind) {
    logger.debug(
      { dragged, kind },
      `find drop zones for ${this.playerId} (${kind})`
    )
    return findZone(
      this,
      dragged,
      zone => (zone.playerId ? this.canAccept(zone, kind) : false),
      kind
    )
  }

  /**
   * Finds drop zones physically bellow a given mesh.
   * Only enabled zones accepting the dragged kind will match.
   * In case several zones are bellow the mesh, the one with highest priority, or with highest elevation, will prevail.
   * The found zone is highlithed, and the dragged mesh will be saved as potential droppable for this zone.
   *
   * @param {import('@babylonjs/core').Mesh} dragged - a dragged mesh.
   * @param {string} [kind] - drag kind.
   * @returns matching zone, if any.
   */
  findDropZone(dragged, kind) {
    logger.debug(
      { dragged, kind },
      `find drop zones for ${dragged?.id} (${kind})`
    )
    return findZone(
      this,
      dragged,
      (zone, partCenters) =>
        this.canAccept(zone, kind) &&
        isAbove(dragged, zone.mesh) &&
        isAPartCenterClose(dragged, partCenters, zone),
      kind
    )
  }

  /**
   * Clears all droppable meshes of a given drop zone, and stops highlighting it.
   * @param {?DropZone} [zone] - the cleared drop zone.
   */
  clear(zone) {
    if (!zone) return
    this.droppablesByDropZone.delete(zone)
    if ('parts' in zone) {
      for (const part of zone.parts) {
        clearZone(part)
      }
    } else {
      clearZone(zone)
    }
  }

  /**
   * If the provided target as droppable meshes, performs a drop operation, that is,
   * notifying drop observers of the corresponding Targetable behavior.
   * It clears the target.
   * @param {DropZone} zone - the zone dropped onto.
   * @param {Partial<DropDetails>} props - other properties passed to the drop zone observables
   * @returns list of droppable meshes, if any.
   */
  dropOn(zone, props = {}) {
    const dropped = this.droppablesByDropZone.get(zone) ?? []
    if (dropped.length) {
      logger.info(
        { zone, dragged: dropped },
        `performs drop over mesh ${zone.targetable.mesh?.id} for ${dropped.map(
          ({ id }) => id
        )}`
      )
      zone.targetable.onDropObservable.notifyObservers({
        ...props,
        dropped,
        zone
      })
    }
    this.clear(zone)
    return dropped
  }

  /**
   * Determines whether a given zone can accept a given kind, based on:
   * - allowed kinds
   * - current player Id
   * - enable status
   * Does not consider mesh position.
   * @param {Partial<SingleDropZone>} [zone] - the tested zone.
   * @param {string} [kind] - the tested kind.
   * @returns true if provided kind is acceptable.
   */
  canAccept(zone, kind) {
    if (!zone || !zone.enabled) return false
    return (
      (!zone.playerId ? true : zone.playerId === this.playerId) &&
      (!zone.kinds ? true : !kind ? false : zone.kinds.includes(kind))
    )
  }
}

/**
 * @param {TargetManager} manager - manager instance.
 * @param {import('@babylonjs/core').Mesh} dragged - dragged mesh to check.
 * @param {(zone: SingleDropZone, partCenters: import('@babylonjs/core').Vector3[]) => boolean} isMatching - matching function to test candidate zones.
 * @param {string} [kind] - dragged kind.
 * @returns  matching zone, if any.
 */
function findZone(manager, dragged, isMatching, kind) {
  const { behaviors, scene: mainScene, managers } = manager
  const partCenters = getMeshAbsolutePartCenters(dragged)
  /** @type {Candidate[]} */
  const zones = []
  const scene = dragged.getScene()
  if (scene !== mainScene) {
    // until we support target in hand, rely on manager.scene only
    return null
  }
  const excluded = [dragged, ...managers.selection.meshes]
  for (const targetable of behaviors) {
    const { mesh } =
      /** @type {import('../behaviors').TargetBehavior & { mesh: import('@babylonjs/core').Mesh }} */ (
        targetable
      )
    if (!excluded.includes(mesh) && mesh.getScene() === scene) {
      for (const zone of targetable.zones) {
        if (isMatching(zone, partCenters)) {
          zones.push({
            zone,
            distance: distance(
              { x: dragged.absolutePosition.x, y: dragged.absolutePosition.z },
              {
                x: zone.mesh.absolutePosition.x,
                y: zone.mesh.absolutePosition.z
              }
            )
          })
        }
      }
    }
  }
  sortCandidates(zones)
  logger.debug({ dragged, zones }, `${zones.length} candidate(s) found`)
  if (!zones.length) {
    return null
  }
  const zone =
    partCenters?.length === 1
      ? zones[0].zone
      : zones.find(({ zone: { ignoreParts } }) => ignoreParts)?.zone ??
        buildMultiZone(partCenters, zones)
  return highlightZone(manager, zone, dragged, kind)
}

/**
 * @param {TargetManager} manager - manager instance.
 * @param {?DropZone} zone - matching zone to highlight.
 * @param {import('@babylonjs/core').Mesh} dragged - dragged mesh to check.
 * @param {string} [kind] - dragged kind.
 * @returns matching zone, if any.
 */
function highlightZone(manager, zone, dragged, kind) {
  if (!zone) {
    return null
  }
  const droppables = manager.droppablesByDropZone.get(zone) ?? []
  manager.droppablesByDropZone.set(zone, [...droppables, dragged])
  logger.info(
    { zone, dragged },
    `found drop zone ${zone.targetable.mesh?.id} for ${dragged?.id} (${kind})`
  )
  for (const { mesh } of zone.parts ?? [zone]) {
    if (mesh?.visibility === 0) {
      mesh.material = manager.material
      mesh.visibility = 1
      mesh.enableEdgesRendering()
      mesh.edgesWidth = 5.0
      mesh.edgesColor = manager.color
    }
  }
  return zone
}

function clearZone(/** @type {?SingleDropZone} */ zone) {
  if (zone?.mesh) {
    zone.mesh.visibility = 0
    zone.mesh.disableEdgesRendering()
  }
}

/**
 * @param {Candidate[]} candidates - candidate zone.
 * @returns the sorted zones, closest, highest and most priority first.
 */
function sortCandidates(candidates) {
  return candidates.sort(
    (
      { zone: { mesh: meshA, priority: priorityA }, distance: distanceA },
      { zone: { mesh: meshB, priority: priorityB }, distance: distanceB }
    ) =>
      distanceA === distanceB
        ? meshB.absolutePosition.y === meshA.absolutePosition.y
          ? priorityB - priorityA
          : meshB.absolutePosition.y - meshA.absolutePosition.y
        : distanceA - distanceB
  )
}

/**
 * @param {import('@babylonjs/core').Mesh} mesh - considered mesh.
 * @param {import('@babylonjs/core').Vector3[]} partCenters - part position for this mesh.
 * @param {SingleDropZone} zone - candidate zone.
 * @returns whether this zone is close to the mesh or one of its part.
 */
function isAPartCenterClose(mesh, partCenters, zone) {
  if (zone.ignoreParts) {
    return isCloseTo(mesh.absolutePosition, zone)
  }
  for (const point of partCenters) {
    if (isCloseTo(point, zone)) {
      return true
    }
  }
  return false
}

/**
 * @param {import('@babylonjs/core').Vector3} position - checked position.
 * @param {SingleDropZone} zone - candidate zone.
 * @returns whether this candidate is close enough to the point.
 */
function isCloseTo(
  { x, z },
  {
    mesh: {
      absolutePosition: { x: targetX, z: targetZ }
    },
    extent
  }
) {
  return distance({ x, y: z }, { x: targetX, y: targetZ }) <= extent
}

/**
 * @param {import('@babylonjs/core').Vector3[]} partCenters - absolute position of the mesh parts.
 * @param {Candidate[]} candidates - list of drop zones to group together.
 * @returns the built multi drop zone, if all parts have a matching zone.
 */
function buildMultiZone(partCenters, candidates) {
  const multiZone = /** @type {MultiDropZone} */ ({
    parts: /** @type {SingleDropZone[]} */ ([])
  })
  const remainingCandidates = [...candidates]
  for (const point of partCenters) {
    let covered = false
    for (const [i, candidate] of remainingCandidates.entries()) {
      if (isCloseTo(point, candidate.zone)) {
        multiZone.parts.push(candidate.zone)
        // do not use the same zone for several points
        remainingCandidates.splice(i, 1)
        covered = true
        break
      }
    }
    if (!covered) {
      return null
    }
  }
  multiZone.targetable = multiZone.parts[0].targetable
  multiZone.mesh = multiZone.parts[0].mesh
  return multiZone
}
