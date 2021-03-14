import Babylon from 'babylonjs'
import { TargetBehavior } from './targetable'
import { dragManager, multiSelectionManager } from '../managers'
import { animateMove, getTargetableBehavior } from '../utils'
const { Vector3 } = Babylon

export class StackBehavior extends TargetBehavior {
  constructor({ moveDuration } = {}) {
    super()
    this.moveDuration = moveDuration || 0.1
    this.dropObserver = null
    this.stack = []
    dragManager.onDragStartObservable.add(({ mesh }) => {
      // pop the last item if it's dragged, unless:
      // 1. there's only one item
      // 2. the first item is also dragged (we're dragging the whole stack)
      // for staks of several items:
      if (this.stack.length > 1) {
        if (multiSelectionManager.meshes.includes(this.stack[0])) {
          // disable target when dragging the whole stack
          this.enabled = false
          dragManager.onDragEndObservable.addOnce(() => (this.enabled = true))
        } else if (mesh === this.stack[this.stack.length - 1]) {
          // or pop last item when dragged
          this.pop()
        }
      }
    })
  }

  get name() {
    return StackBehavior.NAME
  }

  attach(mesh) {
    super.attach(mesh)
    this.stack = [mesh]
    this.dropObserver = this.onDropObservable.add(({ dragged }) =>
      this.push(dragged)
    )
    // TODO automatically define target, and disable function
  }

  detach() {
    super.detach()
    this.onDropObservable?.remove(this.dropObserver)
  }

  push(mesh) {
    const { stack, moveDuration } = this
    stack.push(mesh)
    const { x, z } = stack[0].absolutePosition
    animateMove(mesh, new Vector3(x, mesh.absolutePosition.y, z), moveDuration)
    const targetable = getTargetableBehavior(mesh)
    if (targetable) {
      targetable.enabled = false
    }
  }

  pop() {
    const { stack } = this
    if (stack.length <= 0) {
      return
    }
    const mesh = stack.pop()
    const targetable = getTargetableBehavior(mesh)
    if (targetable) {
      targetable.enabled = true
    }
    return mesh
  }
}

StackBehavior.NAME = 'stackable'
