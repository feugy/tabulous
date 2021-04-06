import { Color3, HighlightLayer } from '@babylonjs/core'
import { DragBehavior } from '../behaviors'
import { isAbove } from '../utils'
import { multiSelectionManager } from './multi-selection'

class TargetManager {
  constructor() {
    this.behaviors = []
    this.highlight = null
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
      if (!this.highlight || this.highlight.isDisposed) {
        this.highlight = new HighlightLayer('target-highlight')
        this.highlight.innerGlow = false
        this.highlight.onDisposeObservable.addOnce(() => {
          this.highlight = null
        })
      }
      target.zone.visibility = 0.01
      this.highlight.addMesh(target.zone, Color3.Green())
    }
  }

  hideTarget(target) {
    if (target?.zone) {
      target.zone.visibility = 0
      this.highlight.removeMesh(target.zone)
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
