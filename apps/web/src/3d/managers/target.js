import { Color3 } from '@babylonjs/core'
import { DragBehavior } from '../behaviors'
import { isAbove } from '../utils'
import { multiSelectionManager } from './multi-selection'

class TargetManager {
  constructor() {
    this.behaviors = []
  }

  registerTargetable(behavior) {
    this.behaviors.push(behavior)
  }

  unregisterTargetable(behavior) {
    const idx = this.behaviors.indexOf(behavior)
    if (idx >= 0) {
      this.behaviors.splice(idx, 1)
    }
  }

  showTarget(target) {
    if (target?.zone) {
      target.zone.visibility = 0.1
      target.zone.enableEdgesRendering()
      target.zone.edgesWidth = 5.0
      target.zone.edgesColor = Color3.Green().toColor4()
    }
  }

  hideTarget(target) {
    if (target?.zone) {
      target.zone.visibility = 0
      target.zone.disableEdgesRendering()
    }
  }

  findTarget(dragged, kind) {
    const dragBehavior = dragged.getBehaviorByName(DragBehavior.NAME)
    if (dragBehavior) {
      const candidates = []
      const excluded = [dragged, ...multiSelectionManager.meshes]
      for (const behavior of this.behaviors) {
        if (behavior.enabled && !excluded.includes(behavior.mesh)) {
          for (const target of behavior.targets) {
            const { zone, scale, kinds } = target
            if (kinds.includes(kind) && isAbove(dragged, zone, scale)) {
              candidates.push({
                behavior,
                target,
                y: behavior.mesh.absolutePosition.y
              })
            }
          }
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.y - a.y)
        const [{ target, behavior }] = candidates
        return {
          zone: target.zone,
          mesh: behavior.mesh,
          drop() {
            behavior.onDropObservable.notifyObservers({
              dragged,
              target
            })
          }
        }
      }
    }
  }
}

export const targetManager = new TargetManager()
