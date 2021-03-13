import { TargetBehavior } from './targetable'
import { animateMove, applyGravity, getTargetableBehavior } from './utils'

export class StackBehavior extends TargetBehavior {
  constructor({ moveDuration } = {}) {
    super()
    this.moveDuration = moveDuration || 0.1
    this.dropObserver = null
  }

  get name() {
    return 'stack'
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
    animateMove(mesh, stack[0].absolutePosition, moveDuration, () =>
      applyGravity(mesh)
    )
    mesh
      .getBehaviorByName('drag')
      ?.onDragStartObservable.addOnce(() => this.pop())
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
