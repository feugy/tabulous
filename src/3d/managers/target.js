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

  showTarget({ box } = {}) {
    if (box) {
      box.visibility = 0.5
    }
  }

  hideTarget({ box } = {}) {
    if (box) {
      box.visibility = 0
    }
  }

  findTarget(dragged, kind) {
    const dragBehavior = dragged.getBehaviorByName(DragBehavior.NAME)
    if (dragBehavior) {
      const candidates = []
      const excluded = [dragged, ...multiSelectionManager.meshes]
      for (const target of this.behaviors) {
        if (target.enabled && !excluded.includes(target.mesh)) {
          for (const { box, kinds } of target.collisionBoxes) {
            if (kinds.includes(kind) && isAbove(dragged, box)) {
              candidates.push({
                target,
                box,
                y: target.mesh.absolutePosition.y
              })
            }
          }
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.y - a.y)
        const [{ box, target }] = candidates
        return {
          box,
          mesh: target.mesh,
          drop() {
            target.onDropObservable.notifyObservers({ dragged, box })
          }
        }
      }
    }
  }
}

export const targetManager = new TargetManager()
