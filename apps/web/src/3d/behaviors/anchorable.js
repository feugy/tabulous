// @ts-check
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import { makeLogger } from '../../utils/logger'
import { actionNames } from '../utils/actions'
import {
  animateMove,
  attachFunctions,
  attachProperty,
  buildTargetMesh,
  getMeshAbsolutePartCenters,
  getPositionAboveZone,
  getTargetableBehavior
} from '../utils/behaviors'
import { AnchorBehaviorName } from './names'
import { TargetBehavior } from './targetable'

/** @typedef {import('@tabulous/types').AnchorableState & Required<Pick<import('@tabulous/types').AnchorableState, 'duration'|'anchors'>>} RequiredAnchorableState */

const logger = makeLogger(AnchorBehaviorName)

export class AnchorBehavior extends TargetBehavior {
  /**
   * Creates behavior to make a mesh anchorable: it has one or several anchors to snap other meshes.
   * Each anchor can take up to one mesh only.
   * @param {import('@tabulous/types').AnchorableState} state - behavior state.
   * @param {import('../managers').Managers} managers - current managers.
   */
  constructor(state, managers) {
    super({}, managers)
    /** the behavior's current state. */
    this.state = /** @type {RequiredAnchorableState} */ (state)
    /** @protected @type {?import('@babylonjs/core').Observer<import('../managers').DropDetails>} */
    this.dropObserver = null
    /** @protected @type {?import('@babylonjs/core').Observer<import('../managers').MoveDetails>} */
    this.moveObserver = null
    /** @protected @type {?import('@babylonjs/core').Observer<import('@tabulous/types').ActionOrMove>}} */
    this.actionObserver = null
    /** @internal @type {Map<string, import('../managers').SingleDropZone>} */
    this.zoneBySnappedId = new Map()
  }

  get name() {
    return AnchorBehaviorName
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - the `anchors` property.
   * - the `snap()` method.
   * - the `unsnap()` method.
   * - the `unsnapAll()` method.
   * It binds to its drop observable to snap dropped meshes on the anchor (unless the anchor is already full).
   * It binds to the drag manager to unsnap dragged meshes, when dragged independently from the current mesh
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes anchorable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this.state)

    this.dropObserver = this.onDropObservable.add(
      ({ dropped, zone, immediate, isLocal }) => {
        // only considers first dropped mesh.
        internalSnap(
          this,
          dropped[0]?.id,
          zone.mesh.id,
          immediate ?? false,
          isLocal
        )
      }
    )

    this.moveObserver = this.managers.move.onMoveObservable.add(({ mesh }) => {
      // unsnap the moved mesh, unless:
      // 1. it is not snapped!
      // 2. it is moved together with the current mesh
      if (
        this.zoneBySnappedId.has(mesh?.id) &&
        !(
          this.managers.selection.meshes.has(mesh) &&
          this.managers.selection.meshes.has(
            /** @type {import('@babylonjs/core').Mesh} */ (this.mesh)
          )
        )
      ) {
        this.unsnap(mesh.id)
      }
    })

    this.actionObserver = this.managers.control.onActionObservable.add(
      async actionOrMove => {
        // 1. unsnap all when drawing main mesh
        // 2. unsnap drawn snapped mesh
        if ('fn' in actionOrMove && this.mesh) {
          const { meshId, fn, args } = actionOrMove
          if (meshId === this.mesh.id && fn === actionNames.draw) {
            for (const snappedId of this.getSnappedIds()) {
              internalUnsnap(this, snappedId, undefined, true)
            }
          } else {
            const zone = this.zoneBySnappedId.get(meshId)
            if (zone) {
              if (fn === actionNames.reorder || fn === actionNames.flipAll) {
                const scene = this.mesh.getScene()
                const stack = getMeshList(scene, meshId)
                if (stack) {
                  const snapped =
                    fn === actionNames.flipAll
                      ? stack.reverse()[0]
                      : stack.find(({ id }) => id === args[0][0])
                  unsetAnchor(this, zone, stack[0])
                  if (snapped) {
                    setAnchor(this, zone, snapped)
                  }
                }
              } else if (fn === actionNames.draw) {
                internalUnsnap(this, meshId, undefined, true)
              }
            }
          }
        }
      }
    )
  }

  /**
   * Detaches this behavior from its mesh.
   */
  detach() {
    this.managers.control.onActionObservable.remove(this.actionObserver)
    this.managers.move.onMoveObservable.remove(this.moveObserver)
    this.onDropObservable?.remove(this.dropObserver)
    super.detach()
  }

  /**
   * Enables all anchors, if they don't have any snapped mesh.
   */
  enable() {
    for (const zone of [...this.zones]) {
      if (!this.state.anchors[zone.anchorIndex].snappedId) {
        zone.enabled = true
      }
    }
  }

  /**
   * Disables all anchors
   */
  disable() {
    for (const zone of [...this.zones]) {
      zone.enabled = false
    }
  }

  /**
   * @returns ids for the meshes snapped to this one
   */
  getSnappedIds() {
    return [...this.zoneBySnappedId.keys()]
  }

  /**
   * @param {string} zoneId - id of a tested zone.
   * @returns whether a given zone should flip its snapped mesh.
   */
  getZoneFlip(zoneId) {
    return this.state.anchors.find(({ id }) => id === zoneId)?.flip
  }

  /**
   * Span another mesh onto an anchor:
   * - records the action into the control manager
   * - disables this zone so it can not be used
   * - moves the mesh to the provided anchor with gravity
   * Does nothing if the mesh or the anchor does not exist.
   * Does nothing if the anchor is diabled.
   *
   * @param {string} snappedId - id of the snapped mesh.
   * @param {string} anchorId - id of the anchor mesh to snap onto.
   * @param {boolean} [immediate=false] - set to true to disable animation.
   */
  async snap(snappedId, anchorId, immediate = false) {
    await internalSnap(this, snappedId, anchorId, immediate)
  }

  /**
   * Release a snapped mesh from an anchor:
   * - records the action into the control manager
   * - enables the relevant zone so it can not be reused
   * Does nothing if the mesh does not exist or is not snapped.
   *
   * @param {string} releasedId - id of the released mesh.
   */
  async unsnap(releasedId) {
    await internalUnsnap(this, releasedId)
  }

  /**
   * Release all snapped meshes
   */
  unsnapAll() {
    for (const id of this.getSnappedIds()) {
      this.unsnap(id)
    }
  }

  /**
   * Returns the zone to which a given mesh is snapped
   * @param {string} meshId - id of the tested mesh
   * @returns zone to which this mesh is snapped, if any
   */
  snappedZone(meshId) {
    return this.zoneBySnappedId.get(meshId) ?? null
  }

  /**
   * Revert snap and unsnap actions. Ignores other actions
   * @param {import('@tabulous/types').ActionName} action - reverted action.
   * @param {any[]} [args] - reverted arguments.
   */
  async revert(action, args = []) {
    if (action === actionNames.snap && args.length === 4) {
      const [snappedId, position, angle, isFlipped] = args
      const released = await internalUnsnap(this, snappedId, isFlipped, true)
      if (released) {
        await animateMove(
          released,
          Vector3.FromArray(position),
          angle != undefined
            ? new Vector3(released.rotation.x, angle, released.rotation.z)
            : null,
          this.state.duration,
          false
        )
      }
    } else if (action === actionNames.unsnap && args.length === 2) {
      const [releaseId, zoneId] = args
      await internalSnap(this, releaseId, zoneId, false, true)
    }
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {import('@tabulous/types').AnchorableState} state - state to update to.
   */
  fromState({ anchors = [], duration = 100 } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    // dispose previous anchors
    for (const zone of [...this.zones]) {
      this.removeZone(zone)
    }
    this.zoneBySnappedId.clear()
    this.state = { anchors, duration }
    for (const [
      i,
      { id, x, y, z, width, depth, height, diameter, snappedId, ...zoneProps }
    ] of this.state.anchors.entries()) {
      const dropZone = buildTargetMesh(
        id,
        this.mesh,
        diameter
          ? { diameter, height }
          : {
              width,
              depth,
              height
            }
      )
      dropZone.position = new Vector3(x ?? 0, y ?? 0, z ?? 0)
      dropZone.computeWorldMatrix(true)
      const zone = this.addZone(dropZone, {
        enabled: true,
        ...zoneProps,
        extent: zoneProps.extent || 2
      })
      // relates the created zone with the anchor
      zone.anchorIndex = i
      if (snappedId) {
        snapToAnchor(this, snappedId, zone, true)
      }
    }
    attachFunctions(this, 'snap', 'unsnap', 'unsnapAll')
    attachProperty(this, 'anchors', () => this.state.anchors)
  }
}

/**
 * Internal implementation of the snap/revertUnsnap methods.
 * @param {AnchorBehavior} behavior - concerned behavior.
 * @param {string} snappedId - the snapped mesh id.
 * @param {string} anchorId - the anchor it is snapped to.
 * @param {boolean} immediate - whether to animate the move.
 * @param {boolean} [isLocal] - action locality.
 */
async function internalSnap(
  behavior,
  snappedId,
  anchorId,
  immediate,
  isLocal = false
) {
  let snapped = behavior.mesh?.getScene().getMeshById(snappedId)
  const zone = behavior.zones.find(({ mesh }) => mesh.id === anchorId)
  if (!snapped || !zone || !zone.enabled || !behavior.mesh) {
    return
  }
  const position = snapped.position.asArray()
  const angle = snapped.metadata.angle
  behavior.managers.indicator.registerFeedback({
    action: actionNames.snap,
    position: zone.mesh.absolutePosition.asArray()
  })
  behavior.managers.move.notifyMove(snapped)
  await snapToAnchor(behavior, snappedId, zone, immediate)
  // record after so flippable could flip on demand, after the mesh was snapped.
  behavior.managers.control.record({
    mesh: behavior.mesh,
    fn: actionNames.snap,
    args: [snappedId, anchorId, immediate],
    duration: immediate ? 0 : behavior.state.duration,
    revert: [snappedId, position, angle, snapped.metadata.isFlipped],
    isLocal
  })
  const isFlipped = behavior.getZoneFlip(anchorId)
  if (isFlipped != undefined && snapped.metadata.isFlipped !== isFlipped) {
    await behavior.managers.control.invokeLocal(snapped, actionNames.flip)
  }
}

/**
 * Internal implementation of the unsnap/revertSnap methods.
 * @param {AnchorBehavior} behavior - concerned behavior.
 * @param {string} releasedId - the unsnapped mesh id.
 * @param {boolean} [isFlipped] - new flip status to enforce, if any.
 * @param {boolean} [isLocal] - locality for this action.
 */
async function internalUnsnap(
  behavior,
  releasedId,
  isFlipped = undefined,
  isLocal = false
) {
  const released = getMeshList(behavior.mesh?.getScene(), releasedId)?.[0]

  if (behavior.mesh && released) {
    const snappedId = released.id
    const zone = behavior.zoneBySnappedId.get(snappedId)

    if (zone) {
      logger.info(
        { mesh: behavior.mesh, snappedId, zone },
        `release snapped ${snappedId} from ${behavior.mesh.id}, zone ${zone.mesh.id}`
      )
      if (isFlipped != undefined && released.metadata.isFlipped !== isFlipped) {
        await behavior.managers.control.invokeLocal(released, actionNames.flip)
      }
      behavior.managers.control.record({
        mesh: behavior.mesh,
        fn: actionNames.unsnap,
        args: [releasedId],
        revert: [releasedId, zone.mesh.id],
        isLocal
      })
      unsetAnchor(behavior, zone, released)
      behavior.managers.indicator.registerFeedback({
        action: actionNames.unsnap,
        position: zone.mesh.absolutePosition.asArray()
      })
    }
  }
  return released
}

/**
 * @param {AnchorBehavior} behavior - concerned behavior.
 * @param {string} snappedId - snapped mesh id.
 * @param {import('../managers').SingleDropZone} zone - drop zone.
 * @param {boolean} [loading=false] - whether the scene is loading.
 */
async function snapToAnchor(behavior, snappedId, zone, loading = false) {
  const {
    mesh,
    state: { anchors, duration }
  } = behavior
  if (!mesh) return
  const meshId = mesh.id
  anchors[zone.anchorIndex].snappedId = undefined
  const snapped = getMeshList(mesh.getScene(), snappedId)?.[0]

  if (snapped) {
    logger.info(
      { mesh, snappedId: snapped.id, zone },
      `snap ${snapped.id} onto ${meshId}, zone ${zone.mesh.id}`
    )
    setAnchor(behavior, zone, snapped)

    // moves it to the final position
    const position = getPositionAboveZone(snapped, zone)
    const partCenters = getMeshAbsolutePartCenters(snapped)
    if (!zone.ignoreParts && partCenters) {
      // always use first part as a reference
      position.addInPlace(snapped.absolutePosition.subtract(partCenters[0]))
    }
    const move = animateMove(
      snapped,
      position,
      zone.angle != undefined
        ? new Vector3(
            snapped.rotation.x,
            mesh.rotation.y + zone.angle,
            snapped.rotation.z
          )
        : null,
      loading ? 0 : duration
    )
    if (!loading) {
      await move
    }
  }
}

/**
 * @param {AnchorBehavior} behavior - concerned behavior.
 * @param {import('../managers').SingleDropZone} zone - drop zone.
 * @param {import('@babylonjs/core').Mesh} snapped - snapped mesh.
 */
function setAnchor(behavior, zone, snapped) {
  const {
    mesh,
    zoneBySnappedId,
    state: { anchors }
  } = behavior
  snapped.setParent(mesh)
  zoneBySnappedId.set(snapped.id, zone)
  const anchor = anchors[zone.anchorIndex]
  anchor.snappedId = snapped.id
  zone.enabled = false
}

/**
 * @param {AnchorBehavior} behavior - concerned behavior.
 * @param {import('../managers').SingleDropZone} zone - drop zone.
 * @param {import('@babylonjs/core').Mesh} snapped - unsnapped mesh.
 */
function unsetAnchor(behavior, zone, snapped) {
  const {
    zoneBySnappedId,
    state: { anchors }
  } = behavior
  snapped.setParent(null)
  zoneBySnappedId.delete(snapped.id)
  const anchor = anchors[zone.anchorIndex]
  anchor.snappedId = undefined
  zone.enabled = true
}

/**
 * @param {import('@babylonjs/core').Scene|undefined} scene - scene containing meshes.
 * @param {string} meshId - searched mesh id.
 * @returns list of stacked meshes, if any.
 */
function getMeshList(scene, meshId) {
  let mesh = scene?.getMeshById(meshId)
  if (!mesh) {
    return null
  }
  const stackable = /** @type {?import('.').StackBehavior} */ (
    getTargetableBehavior(mesh)
  )
  return stackable?.stack ? [...stackable.stack] : [mesh]
}
