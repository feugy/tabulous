import { Observable, Vector3 } from '@babylonjs/core'
import { createPeerPointer } from '../peer-pointer'

function getKey(action) {
  return `${action?.meshId}-${action.fn?.toString() || 'pos'}`
}

class ControlManager {
  constructor() {
    this.controlables = new Map()
    this.peerPointers = new Map()
    // prevents loops when applying an received action
    this.inhibit = new Set()
    this.onActionObservable = new Observable()
    this.onPointerObservable = new Observable()
  }

  registerControlable(mesh) {
    if (mesh?.id && !this.controlables.has(mesh.id)) {
      this.controlables.set(mesh.id, mesh)
    }
  }

  unregisterControlable(mesh) {
    this.controlables.delete(mesh?.id)
  }

  record(action) {
    const key = getKey(action)
    if (this.inhibit.has(key) || !this.controlables.has(action?.meshId)) {
      return
    }
    this.onActionObservable.notifyObservers(action)
  }

  recordPointer(position) {
    this.onPointerObservable.notifyObservers({ pointer: position.asArray() })
  }

  apply(action) {
    const mesh = this.controlables.get(action?.meshId)
    if (!mesh) {
      return
    }
    const key = getKey(action)
    this.inhibit.add(key)
    if (action.fn) {
      this.inhibit.add()
      mesh.metadata[action.fn](...(action.args || []))
    } else if (action.pos) {
      mesh.setAbsolutePosition(Vector3.FromArray(action.pos))
    }
    this.inhibit.delete(key)
  }

  movePeerPointer({ peer, pointer }) {
    let mesh = this.peerPointers.get(peer)
    if (!mesh) {
      mesh = createPeerPointer({ id: peer })
      this.peerPointers.set(peer, mesh)
    }
    mesh.setAbsolutePosition(new Vector3(pointer[0], 0.5, pointer[2]))
  }
}

export const controlManager = new ControlManager()
