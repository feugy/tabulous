import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TargetBehavior } from './targetable'
import { animateMove } from '../utils'
import { controlManager, inputManager } from '../managers'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('anchorable')

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
    if (!snapped || !zone || zone.snappedId) return

    logger.info(
      { mesh: this.mesh, snapped, zone },
      `snap ${snappedId} onto ${this.mesh.id}, zone ${anchorId}`
    )
    controlManager.record({
      meshId: this.mesh.id,
      fn: 'snap',
      args: [snappedId, anchorId]
    })
    // only allows one mesh
    zone.enabled = false
    this.zoneBySnappedId.set(snappedId, zone)
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
   * - enables the relevant zone so it can not be reused
   * - records the action into the control manager
   * Does nothing if the mesh does not exist or is not snapped.
   * When the unsnapped id is the current mesh, release all anchors.
   *
   * @param {string} releasedId - id of the released mesh.
   */
  unsnap(releasedId) {
    const zone = this.zoneBySnappedId.get(releasedId)
    if (!zone && this.mesh?.id !== releasedId) return

    controlManager.record({
      meshId: this.mesh.id,
      fn: 'unsnap',
      args: [releasedId]
    })

    if (zone) {
      logger.info(
        { mesh: this.mesh, releasedId, zone },
        `release snapped ${releasedId} from ${this.mesh.id}, zone ${zone.mesh.id}`
      )
      // we're moving an anchored mesh: clears its zone
      zone.enabled = true
      this.zoneBySnappedId.delete(releasedId)
    } else {
      // we're moving the anchorable mesh: it clears all zones
      for (const zone of this.zones) {
        zone.enabled = true
      }
      this.zoneBySnappedId.clear()
      logger.info(
        { mesh: this.mesh },
        `release all meshes snapped onto ${releasedId}`
      )
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
    for (const zone of this.zones) {
      this.removeZone(zone)
    }
    this.zoneBySnappedId.clear()
    // since graphQL returns nulls, we can not use default values
    this.state = { ...state, duration: state.duration || 100 }
    if (Array.isArray(this.state.anchors)) {
      let i = 0
      for (const { x, y, z, width, height, depth, kinds } of this.state
        .anchors) {
        const anchor = BoxBuilder.CreateBox(`anchor-${i++}`, {
          width,
          height: depth,
          depth: height
        })
        anchor.parent = this.mesh
        anchor.position = new Vector3(x ?? 0, y ?? 0, z ?? 0)
        this.addZone(anchor, 0.6, kinds)
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
