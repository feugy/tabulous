import { TargetBehavior } from './targetable'
import { animateMove, applyGravity } from './utils'

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
    console.log(`stack ${mesh.id} above ${stack[stack.length - 1].id}`)
    stack.push(mesh)
    animateMove(mesh, stack[0].absolutePosition, moveDuration, () =>
      applyGravity(mesh)
    )
    mesh
      .getBehaviorByName('drag')
      ?.onDragStartObservable.addOnce(() => this.pop())
  }

  pop() {
    const { stack } = this
    if (stack.length <= 0) {
      return
    }
    console.log(
      `pop ${stack[stack.length - 1].id} from ${stack[stack.length - 2].id}`
    )
    return stack.pop()
  }
}
