import Babylon from 'babylonjs'
import { DragBehavior } from './draggable'
import { isAbove } from '../utils'

const { Observable } = Babylon

const targets = []

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
      targets.push(this)
    }
  }

  detach() {
    const idx = targets.indexOf(this)
    if (idx >= 0) {
      targets.splice(idx, 1)
    }
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

TargetBehavior.showTarget = ({ box } = {}) => {
  if (box) {
    box.visibility = 0.5
  }
}

TargetBehavior.findTarget = dragged => {
  const dragBehavior = dragged.getBehaviorByName(DragBehavior.NAME)
  if (dragBehavior) {
    const candidates = []
    for (const target of targets) {
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

TargetBehavior.hideTarget = ({ box } = {}) => {
  if (box) {
    box.visibility = 0
  }
}

TargetBehavior.NAME = 'targetable'
