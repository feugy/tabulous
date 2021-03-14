import { DragBehavior } from '../behaviors'
import { isAbove } from '../utils'

class TargetManager {
  constructor() {
    this.behaviors = []
  }

  addBehavior(behavior) {
    this.behaviors.push(behavior)
  }

  removeBehavior(behavior) {
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

  findTarget(dragged) {
    const dragBehavior = dragged.getBehaviorByName(DragBehavior.NAME)
    if (dragBehavior) {
      const candidates = []
      for (const target of this.behaviors) {
        if (target.enabled && target.mesh !== dragged) {
          for (const box of target.collisionBoxes) {
            if (isAbove(dragged, box)) {
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
