import { Observable } from '@babylonjs/core'
import { targetManager } from '../managers/target'

export class TargetBehavior {
  constructor() {
    this.mesh = null
    this.enabled = true
    this.targets = []
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
    for (const { zone } of this.targets) {
      zone.dispose()
    }
    this.targets = []
    this.mesh = null
  }

  defineTarget(zone, scale, kinds = []) {
    this.targets.push({ zone, scale, kinds })
    zone.visibility = 0
    zone.isPickable = false
  }
}

TargetBehavior.NAME = 'targetable'
