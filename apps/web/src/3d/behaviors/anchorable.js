import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { AnchorBehaviorName } from './names'
import { TargetBehavior } from './targetable'
import { animateMove } from '../utils'
import { controlManager, inputManager, selectionManager } from '../managers'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'
import { StackBehaviorName } from '.'
import { sleep } from '../../utils'

const logger = makeLogger(AnchorBehaviorName)

/**
 * @typedef {object} Anchor anchor definition on meshes: they acts as drop targets.
 * @property {number} x? - position along the X axis, relative to the mesh's center.
 * @property {number} y? - position along the Y axis, relative to the mesh's center.
 * @property {number} z? - position along the Z axis, relative to the mesh's center.
 * @property {number} width - anchor's width (X axis).
 * @property {number} height - anchor's height (Y axis).
 * @property {number} depth - anchor's depth (Z axis).
 * @property {string[]} kinds? - an optional array of allowed drag kinds for this zone (allows all if not specified).
 * @property {number} priority? - priority applied when multiple targets with same altitude apply.
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
   * It binds to its drop observable to snap dropped meshes on the anchor (unless the anchor is already full).
   * It binds to the drag manager to unsnap dragged meshes, when dragged independently from the current mesh
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
      if (type === 'dragStart' && mesh) {
        let moved = selectionManager.meshes.has(mesh)
          ? selectionManager.meshes.has(this.mesh)
            ? []
            : [...selectionManager.meshes]
          : [mesh]

        unsnapAll(
          this,
          moved.map(({ id }) => id)
        )
      }
    })

    this.actionObserver = controlManager.onActionObservable.add(
      ({ meshId, fn, args }) => {
        const zone = this.zoneBySnappedId.get(meshId)
        if (zone && (fn === 'reorder' || fn === 'flipAll')) {
          const scene = this.mesh.getScene()
          const stack = getMeshList(scene, meshId)
          const released = stack[0]
          const snapped =
            fn === 'flipAll'
              ? stack.reverse()[0]
              : stack.find(({ id }) => id === args[0][0])
          unsetAnchor(this, zone, released)
          setAnchor(this, zone, snapped, true)
        }
      }
    )
  }

  /**
   * Detaches this behavior from its mesh.
   */
  detach() {
    controlManager.onActionObservable.remove(this.actionObserver)
    inputManager.onDragObservable.remove(this.dragObserver)
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
   */
  async snap(snappedId, anchorId) {
    let snapped = this.mesh?.getScene().getMeshById(snappedId)
    const zone = this.zones.find(({ mesh }) => mesh.id === anchorId)
    if (!snapped || !zone || !zone.enabled) {
      return
    }
    controlManager.record({
      meshId: this.mesh.id,
      fn: 'snap',
      args: [snappedId, anchorId]
    })
    await snapToAnchor(this, snappedId, zone)
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
        controlManager.record({ meshId, fn: 'unsnap', args: [releasedId] })
        unsetAnchor(this, zone, released)
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
      { x, y, z, width, depth, height, kinds, priority, snappedId }
    ] of this.state.anchors.entries()) {
      const dropZone = CreateBox(`anchor-${i}`, { width, depth, height })
      dropZone.parent = this.mesh
      dropZone.position = new Vector3(x ?? 0, y ?? 0, z ?? 0)
      dropZone.computeWorldMatrix(true)
      const zone = this.addZone(dropZone, 0.6, kinds, true, priority)
      // relates the created zone with the anchor
      zone.anchorIndex = i
      if (snappedId) {
        snapToAnchor(this, snappedId, zone, false)
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

async function snapToAnchor(behavior, snappedId, zone, animate = true) {
  const {
    mesh,
    state: { anchors, duration }
  } = behavior
  const meshId = mesh.id
  anchors[zone.anchorIndex].snappedId = undefined
  const snappedList = getMeshList(mesh.getScene(), snappedId)

  if (snappedList) {
    const [snapped] = snappedList
    logger.info(
      { mesh, snappedIds: snappedList.map(({ id }) => id), zone },
      `snap ${snapped.id} onto ${meshId}, zone ${zone.mesh.id}`
    )

    // moves it to the final position
    const { x, z } = zone.mesh.getAbsolutePosition()
    if (animate) {
      await Promise.all(
        snappedList.map((snapped, i) =>
          sleep(i * 1.5).then(() =>
            animateMove(
              snapped,
              new Vector3(x, highest(snapped, mesh), z),
              duration,
              true
            )
          )
        )
      )
      setAnchor(behavior, zone, snapped, true)
    } else {
      setAnchor(behavior, zone, snapped, false)
      snappedList.map(snapped =>
        animateMove(snapped, new Vector3(x, highest(snapped, mesh), z), 0, true)
      )
    }
  }
}

function highest(mesh, snapped) {
  return Math.max(mesh.absolutePosition.y, snapped.absolutePosition.y) + 0.001
}

function unsnapAll(behavior, ids) {
  for (const id of ids) {
    behavior.unsnap(id)
  }
}

function setAnchor(behavior, zone, snapped, keepPosition) {
  const {
    mesh,
    zoneBySnappedId,
    state: { anchors }
  } = behavior
  if (!snapped.metadata) {
    snapped.metadata = {}
  }
  // TODO: rename anchor to snappedToId
  snapped.metadata.anchor = mesh.id

  if (keepPosition) {
    snapped.setParent(mesh)
  } else {
    snapped.parent = mesh
    snapped.position = Vector3.Zero()
  }
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
  snapped.metadata.anchor = undefined
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
  const stackable = mesh.getBehaviorByName(StackBehaviorName)
  return stackable?.stack ? [...stackable.stack] : [mesh]
}
