import Babylon from 'babylonjs'
import { isAbove } from './utils'

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
    return 'target'
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

TargetBehavior.showTargets = () => {
  for (const target of targets) {
    if (target.enabled) {
      for (const box of target.collisionBoxes) {
        box.visibility = 0.2
      }
    }
  }
}

TargetBehavior.findTarget = dragged => {
  const dragBehavior = dragged.getBehaviorByName('drag')
  if (dragBehavior) {
    const dropBoxes = []
    for (const target of targets) {
      if (target.enabled && target.mesh !== dragged) {
        for (const box of target.collisionBoxes) {
          if (isAbove(dragged, box)) {
            dropBoxes.push({
              target,
              box,
              y: target.mesh.position.y
            })
          }
        }
      }
    }
    if (dropBoxes.length > 0) {
      dropBoxes.sort((a, b) => b.y - a.y)
      const { target, box } = dropBoxes[0]
      target.onDropObservable.notifyObservers({ dragged, box })
      return target.mesh
    }
  }
}

TargetBehavior.hideTargets = () => {
  for (const target of targets) {
    for (const box of target.collisionBoxes) {
      box.visibility = 0
    }
  }
}
