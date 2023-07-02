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

const logger = makeLogger(AnchorBehaviorName)

/**
 * @typedef {object} Anchor anchor definition on meshes: they acts as drop targets.
 * @property {number} x? - position along the X axis, relative to the mesh's center.
 * @property {number} y? - position along the Y axis, relative to the mesh's center.
 * @property {number} z? - position along the Z axis, relative to the mesh's center.
 * @property {number} width - anchor's width (X axis).
 * @property {number} height - anchor's height (Y axis).
 * @property {number} depth - anchor's depth (Z axis).
 * @property {number} [extent=2] - allowed distance between mesh and anchor center when dropping.
 * @property {string[]} kinds? - an optional array of allowed drag kinds for this zone (allows all if not specified).
 * @property {number} priority? - priority applied when multiple targets with same altitude apply.
 * @property {string} playerId? - when set, only player with this id can use this anchor.
 * @property {string} snappedId? - the currently snapped mesh id.
 * @property {boolean} ignoreParts? - whether this anchor consider a mesh's parts or not.
 * @property {number} angle? - angle, in Radian, applied to the snapped mesh.
 */

/**
 * @typedef {object} AnchorableState behavior persistent state, including:
 * @property {Anchor[]} anchors - array of anchor definitions.
 * @property {number} [duration=100] - duration (in milliseconds) of the snap animation.
 */

export class AnchorBehavior extends TargetBehavior {
  /**
   * Creates behavior to make a mesh anchorable: it has one or several anchors to snap other meshes.
   * Each anchor can take up to one mesh only.
   * @extends {TargetBehavior}
   * @property {AnchorableState} state - the behavior's current state.
   *
   * @param {AnchorableState} state - behavior state.
   */
  constructor(state = {}) {
    super()
    this.state = state
    // private
    this.dropObserver = null
    this.moveObserver = null
    this.actionObserver = null
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
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes anchorable.
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
          selectionManager.meshes.has(this.mesh)
        )
      ) {
        this.unsnap(mesh.id)
      }
    })

    this.actionObserver = controlManager.onActionObservable.add(
      ({ meshId, fn, args, fromHand }) => {
        const zone = this.zoneBySnappedId.get(meshId)
        if (zone) {
          if (fn === actionNames.reorder || fn === actionNames.flipAll) {
            const scene = this.mesh.getScene()
            const stack = getMeshList(scene, meshId)
            const snapped =
              fn === actionNames.flipAll
                ? stack.reverse()[0]
                : stack.find(({ id }) => id === args[0][0])
            unsetAnchor(this, zone, stack[0])
            setAnchor(this, zone, snapped, true)
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
   * @async
   * @param {string} snappedId - id of the snapped mesh.
   * @param {string} anchorId - id of the anchor mesh to snap onto.
   * @param {boolean} [immediate=false] - set to true to disable animation.
   */
  async snap(snappedId, anchorId, immediate = false) {
    let snapped = this.mesh?.getScene().getMeshById(snappedId)
    const zone = this.zones.find(({ mesh }) => mesh.id === anchorId)
    if (!snapped || !zone || !zone.enabled) {
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

    if (released) {
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
      const ids = anchors.map(({ snappedId }) => snappedId).filter(Boolean)
      for (const id of ids) {
        this.unsnap(id)
      }
    }
  }

  /**
   * Returns the zone to which a given mesh is snapped
   * @param {string} meshId - id of the tested mesh
   * @returns {import('./targetable').DropZone | null} zone to which this mesh is snapped, if any
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
    attachFunctions(this, actionNames.snap, actionNames.unsnap, 'unsnapAll')
    attachProperty(this, 'anchors', () => this.state.anchors)
  }
}

async function snapToAnchor(behavior, snappedId, zone, loading = false) {
  const {
    mesh,
    state: { anchors, duration }
  } = behavior
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

function unsetAnchor(behavior, zone, snapped) {
  const {
    zoneBySnappedId,
    state: { anchors }
  } = behavior
  snapped.setParent(null)
  zoneBySnappedId.delete(snapped.id, zone)
  const anchor = anchors[zone.anchorIndex]
  anchor.snappedId = undefined
  zone.enabled = true
}

function getMeshList(scene, meshId) {
  let mesh = scene?.getMeshById(meshId)
  if (!mesh) {
    return null
  }
  const stackable = getTargetableBehavior(mesh)
  return stackable?.stack ? [...stackable.stack] : [mesh]
}
