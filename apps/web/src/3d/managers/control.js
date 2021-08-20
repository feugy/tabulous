import { Observable, PointerEventTypes, Vector3 } from '@babylonjs/core'
import { createPeerPointer } from '../peer-pointer'
import { screenToGround } from '../utils'

function getKey(action) {
  return `${action?.meshId}-${action.fn?.toString() || 'pos'}`
}

/**
 * @typedef {object} Action applied action to a given mesh:
 * @property {string} meshId - modified mesh id.
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
    this.controlables = new Map()
    this.peerPointers = new Map()
    // prevents loops when applying an received action
    this.inhibit = new Set()
  }

  /**
   * Gives a scene to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - scene attached to.
   */
  init({ scene }) {
    scene.onPrePointerObservable.add(({ type, localPosition }) => {
      if (type === PointerEventTypes.POINTERMOVE) {
        const pointer = screenToGround(scene, localPosition)?.asArray()
        if (pointer) {
          this.onPointerObservable.notifyObservers({ pointer })
        }
      }
    })
    scene.onDisposeObservable.addOnce(() => {
      this.onActionObservable.clear()
      this.onPointerObservable.clear()
      this.onDetailedObservable.clear()
    })
  }

  /**
   * Registers a new controllable mesh.
   * Does nothing if this mesh is already managed.
   * @param {object} mesh - controled mesh (needs at least an id property).
   */
  registerControlable(mesh) {
    if (mesh?.id && !this.controlables.has(mesh.id)) {
      this.controlables.set(mesh.id, mesh)
    }
  }

  /**
   * Unregisters a controlled mesh.
   * Does nothing on unmanaged mesh.
   * @param {object} mesh - controlled mesh (needs at least an id property).
   */
  unregisterControlable(mesh) {
    this.controlables.delete(mesh?.id)
  }

  /**
   * Records an actions from one of the controlled meshes, and notifies observers.
   * Does nothing if the source mesh is not controlled.
   * @param {Action} action - recorded action.
   */
  record(action) {
    const key = getKey(action)
    if (!this.inhibit.has(key) && this.controlables.has(action?.meshId)) {
      this.onActionObservable.notifyObservers(action)
    }
  }

  /**
   * Applies an actions to a controlled meshes (`fn` in its metadatas), or changes its position (action.pos is defined).
   * Does nothing if the target mesh is not controlled.
   * @param {Action} action - applied action.
   * @param {boolean} fromPeer - true to indicate this action comes from a remote peer.
   */
  apply(action, fromPeer = false) {
    const mesh = this.controlables.get(action?.meshId)
    if (!mesh) return

    const key = getKey(action)
    // inhibits to avoid looping when this mesh will invoke apply()
    mesh.metadata.fromPeer = fromPeer
    if (fromPeer) {
      this.inhibit.add(key)
    }
    if (action.fn) {
      mesh.metadata[action.fn](...(action.args || []))
    } else if (action.pos) {
      mesh.setAbsolutePosition(Vector3.FromArray(action.pos))
    }
    this.inhibit.delete(key)
    mesh.metadata.fromPeer = null
  }

  /**
   * Moves local object to represents a peer's pointer.
   * Creates this object if it does not exists yet.
   * The peer pointer depth (Y axis) is always ignored and forced to 0.5.
   * @param {object} params - pointer parameters, including:
   * @param {string} params.peer - peer id owning this pointer.
   * @param {number[]} params.pointer - Vector3 components describing the pointer position in 3D engine.
   */
  movePeerPointer({ peer, pointer }) {
    let mesh = this.peerPointers.get(peer)
    if (!mesh) {
      mesh = createPeerPointer({ id: peer })
      this.peerPointers.set(peer, mesh)
    }
    mesh.setAbsolutePosition(new Vector3(pointer[0], 0.5, pointer[2]))
  }

  /**
   * Compares the list of peer pointers with the list of connect peer ids, to remove unnecessary pointers.
   * @param {string[]} connectedPeerIds - list of connected peer ids.
   */
  pruneUnusedPeerPointers(connectedPeerIds) {
    for (const [id, pointer] of this.peerPointers) {
      if (!connectedPeerIds.includes(id)) {
        pointer.dispose()
        this.peerPointers.delete(id)
      }
    }
  }
}

/**
 * Control manager singleton.
 * @type {ControlManager}
 */
export const controlManager = new ControlManager()
