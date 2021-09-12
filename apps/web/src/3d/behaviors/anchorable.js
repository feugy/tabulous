import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { TargetBehavior } from './targetable'
import { animateMove } from '../utils'
import { inputManager } from '../managers'

/**
 * @typedef {object} Anchor anchor definition on meshes: they acts as drop targets.
 * @property {number} x? - position along the X axis, relative to the mesh's center.
 * @property {number} y? - position along the Y axis, relative to the mesh's center.
 * @property {number} z? - position along the Z axis, relative to the mesh's center.
 * @property {number} width - anchor's width (X axis).
 * @property {number} height - anchor's height (Z axis).
 * @property {number} depth? - anchor's depth (Y axis).
 * @property {string[]} kinds? - an array of allowed drag kinds
 */

/**
 * @typedef {object} AnchorableState behavior persistent state, including:
 * @property {Anchor[]} anchors - arry of anchor definitions.
 * @property {Anchor[]} anchors - array of anchor definitions.
 * @property {number} [snapDuration=100] - duration (in milliseconds) of the snapping animation.
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
  constructor(state) {
    super()
    this.state = state
    // private
    this.dropObserver = null
    this.dragObserver = null
    this.zoneByMeshId = new Map()
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return AnchorBehavior.NAME
  }

  /**
   * Attaches this behavior to a mesh.
   * It binds to its drop observable to snap dropped meshes on the anchor (unless the anchor is already full).
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes anchorable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this.state)

    this.dropObserver = this.onDropObservable.add(({ dropped, zone }) => {
      // only considers first dropped mesh.
      const [mesh] = dropped
      // only allows one mesh
      zone.enabled = false
      this.zoneByMeshId.set(mesh.id, zone)
      // moves it to the final position
      const { x, y, z } = zone.mesh.getAbsolutePosition()
      animateMove(
        mesh,
        new Vector3(x, y + 0.1, z),
        this.state.snapDuration,
        true
      )
    })

    this.dragObserver = inputManager.onDragObservable.add(({ type, mesh }) => {
      if (type === 'dragStart' && this.zoneByMeshId.has(mesh?.id)) {
        this.zoneByMeshId.get(mesh.id).enabled = true
        this.zoneByMeshId.delete(mesh.id)
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
   * Updates this behavior's state and mesh to match provided data.
   * @param {AnchorableState} state - state to update to.
   */
  fromState(state) {
    if (!this.mesh) {
      throw new Error('Can not restore anchorable state without mesh')
    }
    if (Array.isArray(state.anchors)) {
      for (const { x, y, z, width, height, depth, kinds } of state.anchors) {
        const anchor = BoxBuilder.CreateBox('anchor', {
          width,
          height: depth,
          depth: height
        })
        anchor.parent = this.mesh
        anchor.position = new Vector3(x ?? 0, y ?? 0, z ?? 0)
        this.addZone(anchor, 0.6, kinds)
      }
    }
  }
}

/**
 * Name of all anchorable behaviors.
 * @static
 * @memberof AnchorBehavior
 * @type {string}
 */
AnchorBehavior.NAME = 'anchorable'
