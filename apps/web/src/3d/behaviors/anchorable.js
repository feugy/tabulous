import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TargetBehavior } from './targetable'
import { animateMove } from '../utils'
import { controlManager, inputManager } from '../managers'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('anchorable')

function updateSnapped(
  snapping,
  snappedId,
  zone,
  behavior,
  inhibitControl = false
) {
  const {
    mesh,
    zoneBySnappedId,
    state: { anchors }
  } = behavior
  const meshId = mesh.id
  const zoneId = zone.mesh.id
  if (snapping) {
    logger.info(
      { mesh, snappedId, zone },
      `snap ${snappedId} onto ${meshId}, zone ${zoneId}`
    )
    if (!inhibitControl) {
      controlManager.record({ meshId, fn: 'snap', args: [snappedId, zoneId] })
    }
    zone.enabled = false
    zoneBySnappedId.set(snappedId, zone)
    anchors[zone.anchorIndex].snappedId = snappedId
  } else {
    logger.info(
      { mesh, snappedId, zone },
      `release snapped ${snappedId} from ${meshId}, zone ${zoneId}`
    )
    if (!inhibitControl) {
      controlManager.record({ meshId, fn: 'unsnap', args: [snappedId] })
    }
    zone.enabled = true
    zoneBySnappedId.delete(snappedId)
    anchors[zone.anchorIndex].snappedId = undefined
  }
}

/**
 * @typedef {object} Anchor anchor definition on meshes: they acts as drop targets.
 * @property {number} x? - position along the X axis, relative to the mesh's center.
 * @property {number} y? - position along the Y axis, relative to the mesh's center.
 * @property {number} z? - position along the Z axis, relative to the mesh's center.
 * @property {number} width - anchor's width (X axis).
 * @property {number} height - anchor's height (Z axis).
 * @property {number} depth? - anchor's depth (Y axis).
 * @property {string[]} kinds? - an array of allowed drag kinds
 * @property {string} snappedId? - the currently snapped mesh id
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
    this.dragObserver = null
    this.zoneBySnappedId = new Map()
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return AnchorBehavior.NAME
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - the `anchors` property.
   * - the `snap()` method.
   * - the `unsnap()` method.
   * It binds to its drop observable to snap dropped meshes on the anchor (unless the anchor is already full).
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes anchorable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this.state)

    this.dropObserver = this.onDropObservable.add(({ dropped, zone }) => {
      // only considers first dropped mesh.
      this.snap(dropped[0]?.id, zone.mesh.id)
    })

    this.dragObserver = inputManager.onDragObservable.add(({ type, mesh }) => {
      if (type === 'dragStart') {
        this.unsnap(mesh.id)
      }
    })
  }

  /**
   * Detaches this behavior from its mesh.
   */
  detach() {
    inputManager.onDragObservable.remove(this.dragObserver)
    this.onDropObservable?.remove(this.dropObserver)
    super.detach()
  }

  /**
   * Span another mesh onto an anchor:
   * - records the action into the control manager
   * - disables this zone so it can not be used
   * - moves the mesh to the provided anchor with gravity
   * Does nothing if the mesh does not exist or is already snapped to an anchor.
   *
   * @async
   * @param {string} snappedId - id of the snapped mesh.
   * @param {string} anchorId - id of the anchor mesh to snap onto.
   */
  async snap(snappedId, anchorId) {
    const snapped = this.mesh?.getScene().getMeshById(snappedId)
    const zone = this.zones.find(({ mesh }) => mesh.id === anchorId)
    if (!snapped || !zone || this.state.anchors[zone.anchorIndex]?.snappedId)
      return

    updateSnapped(true, snappedId, zone, this)
    // moves it to the final position
    const { x, y, z } = zone.mesh.getAbsolutePosition()
    await animateMove(
      snapped,
      new Vector3(x, y + 0.1, z),
      this.state.duration,
      true
    )
  }

  /**
   * Release a snapped mesh from an anchor:
   * - records the action into the control manager
   * - enables the relevant zone so it can not be reused
   * Does nothing if the mesh does not exist or is not snapped.
   * When the unsnapped id is the current mesh, release all anchors.
   *
   * @param {string} releasedId - id of the released mesh.
   */
  unsnap(releasedId) {
    const zone = this.zoneBySnappedId.get(releasedId)
    if (!zone && this.mesh?.id !== releasedId) return

    if (zone) {
      // we're moving an anchored mesh: clears its zone
      updateSnapped(false, releasedId, zone, this)
    } else {
      // we're moving the anchorable mesh: it clears all zones
      for (const [snappedId, zone] of this.zoneBySnappedId.entries()) {
        updateSnapped(false, snappedId, zone, this)
      }
    }
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {AnchorableState} state - state to update to.
   */
  fromState(state = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    // dispose previous anchors
    for (const zone of this.zoneBySnappedId.values()) {
      this.removeZone(zone)
    }
    this.zoneBySnappedId.clear()
    // since graphQL returns nulls, we can not use default values
    this.state = { ...state, duration: state.duration || 100 }
    if (Array.isArray(this.state.anchors)) {
      for (const [i, anchor] of this.state.anchors.entries()) {
        const mesh = BoxBuilder.CreateBox(`anchor-${i}`, {
          width: anchor.width,
          height: anchor.depth,
          depth: anchor.height
        })
        mesh.parent = this.mesh
        mesh.position = new Vector3(anchor.x ?? 0, anchor.y ?? 0, anchor.z ?? 0)
        const zone = this.addZone(mesh, 0.6, anchor.kinds)
        // relates the created zone with the anchor
        zone.anchorIndex = i
        if (anchor.snappedId) {
          updateSnapped(true, anchor.snappedId, zone, this, true)
        }
      }
    }
    if (!this.mesh.metadata) {
      this.mesh.metadata = {}
    }
    this.mesh.metadata.snap = this.snap.bind(this)
    this.mesh.metadata.unsnap = this.unsnap.bind(this)
    this.mesh.metadata.anchors = this.state.anchors
  }
}

/**
 * Name of all anchorable behaviors.
 * @static
 * @memberof AnchorBehavior
 * @type {string}
 */
AnchorBehavior.NAME = 'anchorable'
