// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@tabulous/server/src/graphql/types').AnchorableState} AnchorableState
 * @typedef {import('@src/3d/behaviors/stackable').StackBehavior} StackBehavior
 * @typedef {import('@src/3d/behaviors/targetable').DropDetails} DropDetails
 * @typedef {import('@src/3d/managers/control').Action} Action
 * @typedef {import('@src/3d/managers/control').Move} Move
 * @typedef {import('@src/3d/managers/move').MoveDetails} MoveDetails
 * @typedef {import('@src/3d/managers/target').SingleDropZone} SingleDropZone
 */
/**
 * @template T
 * @typedef {import('@babylonjs/core').Observer<T>} Observer
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import { makeLogger } from '../../utils/logger'
import { controlManager } from '../managers/control'
import { indicatorManager } from '../managers/indicator'
import { moveManager } from '../managers/move'
import { selectionManager } from '../managers/selection'
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

/** @typedef {AnchorableState & Required<Pick<AnchorableState, 'duration'|'anchors'>>} RequiredAnchorableState */

const logger = makeLogger(AnchorBehaviorName)

export class AnchorBehavior extends TargetBehavior {
  /**
   * Creates behavior to make a mesh anchorable: it has one or several anchors to snap other meshes.
   * Each anchor can take up to one mesh only.
   * @param {AnchorableState} state - behavior state.
   */
  constructor(state = {}) {
    super()
    /** @type {RequiredAnchorableState} state - the behavior's current state. */
    this.state = /** @type {RequiredAnchorableState} */ (state)
    /** @protected @type {?Observer<DropDetails>} */
    this.dropObserver = null
    /** @protected @type {?Observer<MoveDetails>} */
    this.moveObserver = null
    /** @protected @type {?Observer<Action|Move>}} */
    this.actionObserver = null
    /** @internal @type {Map<?, ?>} */
    this.zoneBySnappedId = new Map()
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
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
   * @param {Mesh} mesh - which becomes anchorable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this.state)

    this.dropObserver = this.onDropObservable.add(
      ({ dropped, zone, immediate }) => {
        // only considers first dropped mesh.
        this.snap(dropped[0]?.id, zone.mesh.id, immediate)
      }
    )

    this.moveObserver = moveManager.onMoveObservable.add(({ mesh }) => {
      // unsnap the moved mesh, unless:
      // 1. it is not snapped!
      // 2. it is moved together with the current mesh
      if (
        this.zoneBySnappedId.has(mesh?.id) &&
        !(
          selectionManager.meshes.has(mesh) &&
          selectionManager.meshes.has(/** @type {Mesh} */ (this.mesh))
        )
      ) {
        this.unsnap(mesh.id)
      }
    })

    this.actionObserver = controlManager.onActionObservable.add(
      ({ meshId, fn, args, fromHand }) => {
        const zone = this.zoneBySnappedId.get(meshId)
        if (zone && this.mesh) {
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
          } else if (fn === actionNames.draw && !fromHand) {
            this.unsnap(meshId)
          }
        }
      }
    )
  }

  /**
   * Detaches this behavior from its mesh.
   */
  detach() {
    controlManager.onActionObservable.remove(this.actionObserver)
    moveManager.onMoveObservable.remove(this.moveObserver)
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
   * @returns {String[]} ids for the meshes snapped to this one
   */
  getSnappedIds() {
    return [...this.zoneBySnappedId.keys()]
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
   * @returns {Promise<void>}
   */
  async snap(snappedId, anchorId, immediate = false) {
    let snapped = this.mesh?.getScene().getMeshById(snappedId)
    const zone = this.zones.find(({ mesh }) => mesh.id === anchorId)
    if (!snapped || !zone || !zone.enabled || !this.mesh) {
      return
    }
    controlManager.record({
      mesh: this.mesh,
      fn: actionNames.snap,
      args: [snappedId, anchorId, immediate],
      duration: immediate ? 0 : this.state.duration
    })
    indicatorManager.registerFeedback({
      action: actionNames.snap,
      position: zone.mesh.absolutePosition.asArray()
    })
    moveManager.notifyMove(snapped)
    await snapToAnchor(this, snappedId, zone, immediate)
  }

  /**
   * Release a snapped mesh from an anchor:
   * - records the action into the control manager
   * - enables the relevant zone so it can not be reused
   * Does nothing if the mesh does not exist or is not snapped.
   *
   * @param {string} releasedId - id of the released mesh.
   */
  unsnap(releasedId) {
    const meshId = this.mesh?.id
    const released = getMeshList(this.mesh?.getScene(), releasedId)?.[0]

    if (this.mesh && released) {
      const snappedId = released.id
      const zone = this.zoneBySnappedId.get(snappedId)

      if (zone) {
        logger.info(
          { mesh: this.mesh, snappedId, zone },
          `release snapped ${snappedId} from ${meshId}, zone ${zone.mesh.id}`
        )
        unsetAnchor(this, zone, released)
        controlManager.record({
          mesh: this.mesh,
          fn: actionNames.unsnap,
          args: [releasedId]
        })
        indicatorManager.registerFeedback({
          action: actionNames.unsnap,
          position: zone.mesh.absolutePosition.asArray()
        })
      }
    }
  }

  /**
   * Release all snapped meshes
   */
  unsnapAll() {
    const {
      mesh,
      state: { anchors }
    } = this
    if (mesh) {
      const ids = /** @type {string[]} */ (
        anchors.map(({ snappedId }) => snappedId).filter(Boolean)
      )
      for (const id of ids) {
        this.unsnap(id)
      }
    }
  }

  /**
   * Returns the zone to which a given mesh is snapped
   * @param {string} meshId - id of the tested mesh
   * @returns {?SingleDropZone} zone to which this mesh is snapped, if any
   */
  snappedZone(meshId) {
    return this.zoneBySnappedId.get(meshId) ?? null
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {AnchorableState} state - state to update to.
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
      { x, y, z, width, depth, height, diameter, snappedId, ...zoneProps }
    ] of this.state.anchors.entries()) {
      const dropZone = buildTargetMesh(
        `anchor-${i}`,
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
 * @param {AnchorBehavior} behavior - concerned behavior.
 * @param {string} snappedId - snapped mesh id.
 * @param {SingleDropZone} zone - drop zone.
 * @param {boolean} [loading=false] - whether the scene is loading.
 * @returns {Promise<void>}
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
 * @param {SingleDropZone} zone - drop zone.
 * @param {Mesh} snapped - snapped mesh.
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
 * @param {SingleDropZone} zone - drop zone.
 * @param {Mesh} snapped - unsnapped mesh.
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
 * @param {Scene|undefined} scene - scene containing meshes.
 * @param {string} meshId - searched mesh id.
 * @returns {?Mesh[]} list of stacked meshes, if any.
 */
function getMeshList(scene, meshId) {
  let mesh = scene?.getMeshById(meshId)
  if (!mesh) {
    return null
  }
  const stackable = /** @type {?StackBehavior} */ (getTargetableBehavior(mesh))
  return stackable?.stack ? [...stackable.stack] : [mesh]
}
