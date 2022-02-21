import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Observable } from '@babylonjs/core/Misc/observable'
import { createPeerPointer } from '../meshes'
// '../../utils' creates a cyclic dependency in Jest
import { screenToGround } from '../utils/vector'

/**
 * @typedef {object} Action applied action to a given mesh:
 * @property {string} meshId - modified mesh id.
 * @property {string} fn? - optionnal name of the applied action (default to 'pos').
 * @property {any[]} args? - optional argument array for this action.
 * @property {boolean} fromHand? - indicates whether this action comes from hand or main scene.
 */

/**
 * @typedef {object} RecordedAction applied action to a given mesh:
 * @property {import('@babylonjs/cord').Mesh} mesh - modified mesh.
 * @property {string} fn? - optionnal name of the applied action (default to 'pos').
 * @property {any[]} args? - optional argument array for this action.
 */

/**
 * @typedef {number[]} PointerPosition pointer change, as an array of x/z 3D coordinates.
 */

/**
 * @typedef {object} MeshDetails details of a given mesh.
 * @property {import('@babylonjs/core').Mesh} mesh - the detailed mesh.
 * @property {object} data - detailed data, including:
 * @property {string} data.image? - image for that mesh.
 */

class ControlManager {
  /**
   * Creates a manager to remotely control a collection of meshes:
   * - applies actions received to specific meshes
   * - propagates applied actions to observers (with cycle breaker)
   * - controls pointer objects to represent peer players.
   * Clears all observers on scene disposal.
   *
   * @property {Observable<Action>} onActionObservable - emits applied actions.
   * @property {Observable<PointerPosition>} onPointerObservable - emits local pointer 3D position.
   * @property {Observable<MeshDetails>} onDetailedObservable - emits when displaying details of a given mesh.
   */
  constructor() {
    this.onActionObservable = new Observable()
    this.onPointerObservable = new Observable()
    this.onDetailedObservable = new Observable()
    // private
    this.scene = null
    this.handScene = null
    this.controlables = new Map()
    this.peerPointers = new Map()
    // prevents loops when applying an received action
    this.inhibitedKeys = new Set()
  }

  /**
   * Gives a scene to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - main scene.
   * @param {Scene} params.handScene - scene for meshes in hand.
   */
  init({ scene, handScene }) {
    this.scene = scene
    this.handScene = handScene
    this.scene.onPrePointerObservable.add(({ type, localPosition }) => {
      if (type === PointerEventTypes.POINTERMOVE) {
        const pointer = screenToGround(this.scene, localPosition)?.asArray()
        if (pointer) {
          this.onPointerObservable.notifyObservers({ pointer })
        }
      }
    })
    this.scene.onDisposeObservable.addOnce(() => {
      this.onActionObservable.clear()
      this.onPointerObservable.clear()
      this.onDetailedObservable.clear()
    })
  }

  /**
   * Registers a new controllable mesh.
   * Does nothing if this mesh is already managed.
   * @param {import('@babel/core').Mesh} mesh - controled mesh (needs at least an id property).
   */
  registerControlable(mesh) {
    this.controlables.set(mesh.id, mesh)
    mesh.onDisposeObservable.addOnce(() => {
      if (!mesh.isPhantom) {
        this.unregisterControlable(mesh)
      }
    })
  }

  /**
   * Unregisters a controlled mesh.
   * Does nothing on unmanaged mesh.
   * @param {import('@babel/core').Mesh} mesh - controlled mesh (needs at least an id property).
   */
  unregisterControlable(mesh) {
    this.controlables.delete(mesh?.id)
  }

  /**
   * @param {import('@babel/core').Mesh} mesh - tested mesh
   * @returns {boolean} whether this mesh is controlled or not
   */
  isManaging(mesh) {
    return this.controlables.has(mesh?.id)
  }

  /**
   * Records an actions from one of the controlled meshes, and notifies observers.
   * Does nothing if the source mesh is not controlled.
   * @param {RecordedAction} action - recorded action.
   */
  record(action = {}) {
    const { mesh, ...actionProps } = action
    if (
      !this.inhibitedKeys.has(getKey({ meshId: mesh?.id, ...actionProps })) &&
      this.isManaging(mesh)
    ) {
      this.onActionObservable.notifyObservers({
        ...actionProps,
        meshId: mesh.id,
        fromHand:
          this.handScene === mesh.getScene() && actionProps.fn !== 'draw'
      })
    }
  }

  /**
   * Applies an actions to a controlled meshes (`fn` in its metadatas), or changes its position (action.pos is defined).
   * Does nothing if the target mesh is not controlled.
   * Returns when the action is fully applied.
   * @async
   * @param {Action} action - applied action.
   * @param {boolean} fromPeer - true to indicate this action comes from a remote peer.
   */
  async apply(action, fromPeer = false) {
    const mesh = this.controlables.get(action?.meshId)
    if (!mesh) return

    const key = getKey(action)
    // inhibits to avoid looping when this mesh will invoke apply()
    if (fromPeer) {
      this.inhibitedKeys.add(key)
    }
    if (action.fn) {
      await mesh.metadata?.[action.fn]?.(...(action.args || []))
    } else if (action.pos) {
      mesh.setAbsolutePosition(Vector3.FromArray(action.pos))
    }
    this.inhibitedKeys.delete(key)
  }

  /**
   * Moves local object to represents a peer's pointer.
   * Creates this object if it does not exists yet.
   * The peer pointer depth (Y axis) is always ignored and forced to 0.5.
   * @param {object} params - pointer parameters, including:
   * @param {string} params.playerId - id of the pointer owner.
   * @param {number[]} params.pointer - Vector3 components describing the pointer position in 3D engine.
   */
  movePeerPointer({ playerId, pointer }) {
    let peerPointer = this.getPeerPointer(playerId)
    if (!peerPointer) {
      peerPointer = createPeerPointer({ id: playerId })
      this.peerPointers.set(playerId, peerPointer)
    }
    peerPointer.setAbsolutePosition(new Vector3(pointer[0], 0.5, pointer[2]))
  }

  /**
   * Compares the list of peer pointers with the list of connect peer ids, to remove unnecessary pointers.
   * @param {string[]} connectedPeerIds - list of connected peer ids.
   */
  pruneUnusedPeerPointers(connectedPeerIds) {
    for (const [playerId, pointer] of this.peerPointers) {
      if (!connectedPeerIds.includes(playerId)) {
        pointer.dispose(false, true)
        this.peerPointers.delete(playerId)
      }
    }
  }

  /**
   * Returns the peer pointer mesh representing a given player.
   * @param {string} playerId - id of the tested player.
   * @returns {import('@babel/core').Mesh} the corresponding pointer, if any.
   */
  getPeerPointer(playerId) {
    return this.peerPointers.get(playerId)
  }
}

/**
 * Control manager singleton.
 * @type {ControlManager}
 */
export const controlManager = new ControlManager()

function getKey(action) {
  return `${action?.meshId}-${action.fn?.toString() || 'pos'}`
}
