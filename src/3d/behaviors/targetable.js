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
      targetManager.addBehavior(this)
    }
  }

  detach() {
    targetManager.removeBehavior(this)
    for (const collisionBox of this.collisionBoxes) {
      collisionBox.dispose()
    }
    this.collisionBoxes = []
    this.mesh = null
  }

  defineTarget(collisionBox) {
    this.collisionBoxes.push(collisionBox)
    collisionBox.visibility = 0
    collisionBox.isPickable = false
  }
}

TargetBehavior.NAME = 'targetable'
