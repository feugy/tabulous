import { Observable, PointerEventTypes, Scene, Vector3 } from '@babylonjs/core'
import { createPeerPointer } from '../peer-pointer'

function getKey(action) {
  return `${action?.meshId}-${action.fn?.toString() || 'pos'}`
}

function handleInput({ mesh, singleTap, button, manager }) {
  if (singleTap) {
    const fn = button === 0 ? 'flip' : button === 2 ? 'rotate' : null
    if (mesh.metadata?.[fn]) {
      mesh.metadata?.[fn]()
    }
  } else if (mesh.metadata?.images?.front) {
    manager.onDetailedObservable.notifyObservers({ mesh })
  }
}

/**
 * @typedef {object} Action applied action to a given mesh:
 * @property {string} meshId - modified mesh id.
 * @property {string} fn? - optionnal name of the applied action (default to 'pos').
 * @property {any[]} args? - optional argument array for this action.
 */

/**
 * @typedef {object} ImageDefs detailed images definitions for a given mesh:
 * @property {string} front - image for the mesh front face.
 * @property {string} back? - image for the mesh front back.
 */

class ControlManager {
  /**
   * Creates a manager to control a collection of meshes:
   * - runs actions based on user input (clicks, double clicks...)
   * - applies actions received from peers
   * It also controls pointer objects to represent peer players.
   */
  constructor() {
    this.controlables = new Map()
    this.peerPointers = new Map()
    // prevents loops when applying an received action
    this.inhibit = new Set()
    this.onActionObservable = new Observable()
    this.onPointerObservable = new Observable()
    this.onDetailedObservable = new Observable()
  }

  /**
   * Gives a scene to the manager so it can listen to pointer events and trigger behaviors.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - scene attached to.
   */
  init({ scene }) {
    let delayedTap
    scene.onPointerObservable.add(({ type, pickInfo, event: { button } }) => {
      const mesh = pickInfo?.pickedMesh
      if (mesh && this.controlables.has(mesh.id)) {
        if (type === PointerEventTypes.POINTERTAP) {
          // delays event in case a double tap occurs
          delayedTap = setTimeout(
            () => handleInput({ mesh, singleTap: true, button, manager: this }),
            Scene.DoubleClickDelay
          )
        } else if (type === PointerEventTypes.POINTERDOUBLETAP) {
          clearTimeout(delayedTap)
          handleInput({ mesh, singleTap: false, button, manager: this })
        }
      }
    })
  }

  /**
   * Registers a new controllable mesh.
   * Does nothing if this mesh is already controlled.
   * @param {object} mesh - controled mesh (needs at least an id property).
   */
  registerControlable(mesh) {
    if (mesh?.id && !this.controlables.has(mesh.id)) {
      this.controlables.set(mesh.id, mesh)
    }
  }

  /**
   * Unregisters a controlled mesh.
   * Does nothing if this mesh is not yet controlled.
   * @param {object} mesh - controlled mesh (needs at least an id property) .
   */
  unregisterControlable(mesh) {
    this.controlables.delete(mesh?.id)
  }

  /**
   * Records an actions from one of the controlled meshes, and notifies observers.
   * Does nothing if the source mesh is not controlled.
   * @param {Action} action - recorded action
   */
  record(action) {
    const key = getKey(action)
    if (this.inhibit.has(key) || !this.controlables.has(action?.meshId)) {
      return
    }
    this.onActionObservable.notifyObservers(action)
  }

  /**
   * Records a pointer change, and notifies observers.
   * @param {Vector3} position - pointer position in the 3D engine
   */
  recordPointer(position) {
    this.onPointerObservable.notifyObservers({ pointer: position.asArray() })
  }

  /**
   * Applies an actions to a controlled meshes (`fn` in its metadatas), or changes its position (`fn` is 'pos').
   * Does nothing if the target mesh is not controlled.
   * @param {Action} action - applied action
   */
  apply(action) {
    const mesh = this.controlables.get(action?.meshId)
    if (!mesh) {
      return
    }
    const key = getKey(action)
    // inhibits to avoid looping when this mesh will invoke apply()
    mesh.metadata.fromPeer = true
    this.inhibit.add(key)
    if (action.fn) {
      this.inhibit.add()
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
   * @param {string[]} connectedPeers - list of connected peer ids.
   */
  pruneUnusedPeerPointers(connectedPeers) {
    for (const [id, pointer] of this.peerPointers) {
      if (!connectedPeers.includes(id)) {
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
