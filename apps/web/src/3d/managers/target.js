import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js'

import { makeLogger } from '../../utils/logger'
import { distance } from '../../utils/math'
import { getTargetableBehavior } from '../utils/behaviors'
import { isAbove } from '../utils/gravity'
import { selectionManager } from './selection'

const logger = makeLogger('target')

class TargetManager {
  /**
   * Creates a manager to manages drop targets for draggable meshes:
   * - find relevant zones physically bellow a given mesh, according to their kind
   * - highlight zones
   * - drop mesh onto their relevant zones
   * Each registered behavior can have multiple zones
   *
   * @property {import('@babylonjs/core').Scene} scene - the main scene.
   * @property {string} playerId - current player Id.
   */
  constructor() {
    this.scene = null
    this.playerId = null
    // private
    this.behaviors = new Set()
    this.droppablesByDropZone = new Map()
  }

  /**
   * Gives scenes to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - main scene.
   * @param {string} params.playerId - current player Id.
   * @param {string} params.color - hexadecimal color string used for highlighting targets.
   */
  init({ scene, playerId, color }) {
    this.scene = scene
    this.playerId = playerId
    this.material = new StandardMaterial('target-material', scene)
    this.material.diffuseColor = Color3.FromHexString(color)
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
   * @returns {boolean} whether this mesh's target behavior is controlled or not
   */
  isManaging(mesh) {
    return this.behaviors.has(getTargetableBehavior(mesh))
  }

  /**
   * Finds drop zones for a given player id and specified kind.
   * In case several zones are valid, the one with highest priority, or with highest elevation, will prevail.
   * The found zone is highlithed, and the dragged mesh will be saved as potential droppable for this zone.
   *
   * @param {import('@babylonjs/core').Mesh} dragged - a dragged mesh.
   * @param {string} kind - drag kind.
   * @return {import('../behaviors').DropZone|null} matching zone, if any.
   */
  findPlayerZone(dragged, kind) {
    logger.debug(
      { dragged, kind },
      `find drop zones for ${this.playerId} (${kind})`
    )
    const candidates = findCandidates(
      this,
      dragged,
      zone => zone.playerId && this.canAccept(zone, kind)
    )
    return findAndHighlightZone(this, candidates, dragged, kind)
  }

  /**
   * Finds drop zones physically bellow a given mesh.
   * Only enabled zones accepting the dragged kind will match.
   * In case several zones are bellow the mesh, the one with highest priority, or with highest elevation, will prevail.
   * The found zone is highlithed, and the dragged mesh will be saved as potential droppable for this zone.
   *
   * @param {import('@babylonjs/core').Mesh} dragged - a dragged mesh.
   * @param {string} kind - drag kind.
   * @return {import('../behaviors').DropZone|null} matching zone, if any.
   */
  findDropZone(dragged, kind) {
    logger.debug(
      { dragged, kind },
      `find drop zones for ${dragged?.id} (${kind})`
    )
    const candidates = findCandidates(this, dragged, zone => {
      return (
        this.canAccept(zone, kind) &&
        isAbove(dragged, zone.mesh) &&
        areCenterCloseEnough(dragged, zone)
      )
    })
    return findAndHighlightZone(this, candidates, dragged, kind)
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
   * @param {object} props - other properties passed to the drop zone observables
   * @returns {import('@babylonjs/core').Mesh[]} list of droppable meshes, if any.
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
        dropped,
        zone,
        ...props
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
   * @param {import('../behaviors').DropZone} zone - the tested zone.
   * @param {string} kind - the tested kind.
   * @returns {boolean} true if provided kind is acceptable.
   */
  canAccept(zone, kind) {
    return (
      Boolean(zone) &&
      zone.enabled &&
      (!zone.playerId || zone.playerId === this.playerId) &&
      (!zone.kinds || zone.kinds.includes(kind))
    )
  }
}

/**
 * Mesh drop target manager singleton.
 * @type {TargetManager}
 */
export const targetManager = new TargetManager()

function findCandidates({ behaviors, scene }, dragged, isMatching) {
  const candidates = []
  const excluded = [dragged, ...selectionManager.meshes]
  for (const targetable of behaviors) {
    if (
      !excluded.includes(targetable.mesh) &&
      targetable.mesh.getScene() === scene
    ) {
      for (const zone of targetable.zones) {
        if (isMatching(zone)) {
          candidates.push({ targetable, zone })
        }
      }
    }
  }
  logger.info(
    { dragged, candidates },
    `${candidates.length} candidate(s) found`
  )
  return candidates
}

function findAndHighlightZone(manager, candidates, dragged, kind) {
  if (candidates.length > 0) {
    const [match] = sortCandidates(candidates)
    const { targetable, zone } = match
    const droppables = manager.droppablesByDropZone.get(zone) ?? []
    manager.droppablesByDropZone.set(zone, [...droppables, dragged])
    highlightZone(zone, manager.material)
    logger.info(
      { zone, dragged },
      `found drop zone ${targetable.mesh?.id} for ${dragged?.id} (${kind})`
    )
    return zone
  }
}

function sortCandidates(candidates) {
  return candidates.sort(
    (
      { zone: { mesh: meshA, priority: priorityA } },
      { zone: { mesh: meshB, priority: priorityB } }
    ) =>
      meshB.absolutePosition.y === meshA.absolutePosition.y
        ? priorityB - priorityA
        : meshB.absolutePosition.y - meshA.absolutePosition.y
  )
}

function highlightZone(zone, material) {
  if (zone?.mesh?.visibility === 0) {
    zone.mesh.material = material
    zone.mesh.visibility = 1
    zone.mesh.enableEdgesRendering()
    zone.mesh.edgesWidth = 5.0
    zone.mesh.edgesColor = Color4.FromArray([
      ...material.diffuseColor.asArray(),
      1
    ])
  }
}

function areCenterCloseEnough(
  { absolutePosition: { x, z } },
  {
    mesh: {
      absolutePosition: { x: targetX, z: targetZ }
    },
    extent
  }
) {
  return distance({ x, y: z }, { x: targetX, y: targetZ }) <= extent
}
