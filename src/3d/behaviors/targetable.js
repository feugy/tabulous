import Babylon from 'babylonjs'
import { targetManager } from '../managers/target'

const { Observable } = Babylon

export class TargetBehavior {
  constructor() {
    this.mesh = null
    this.enabled = true
    this.collisionBoxes = []
    this.onDropObservable = new Observable()
  }

  get name() {
    return TargetBehavior.NAME
  }

  init() {}

  attach(mesh) {
    if (!this.mesh) {
      this.mesh = mesh
      targetManager.registerTargetable(this)
    }
  }

  detach() {
    targetManager.unregisterTargetable(this)
    for (const { box } of this.collisionBoxes) {
      box.dispose()
    }
    this.collisionBoxes = []
    this.mesh = null
  }

  defineTarget(collisionBox, kinds = []) {
    this.collisionBoxes.push({ box: collisionBox, kinds })
    collisionBox.visibility = 0
    collisionBox.isPickable = false
  }
}

TargetBehavior.NAME = 'targetable'
