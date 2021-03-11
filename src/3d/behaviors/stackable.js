import { TargetBehavior } from './targetable'
import { animateMove } from './utils'

export class StackBehavior extends TargetBehavior {
  constructor({ moveDuration } = {}) {
    super()
    this.moveDuration = moveDuration || 0.1
    this.base = null
    this.next = null
  }

  get name() {
    return 'stack'
  }

  attach(mesh) {
    super.attach(mesh)
    this.base = mesh
    this.next = null
    this.onDropObservable.add(({ dragged }) => this.push(dragged))
  }

  detach() {
    super.detach()
    this.base = null
    this.next = null
  }

  push(mesh) {
    const { base, next } = this
    if (next) {
      return
    }
    // single next is an issue if multiple items are on overlapping current without overlapping themselves
    this.next = mesh

    const newPosition = base.position.clone()
    newPosition.y += 0.01
    animateMove(mesh, newPosition, this.moveDuration)
    mesh
      .getBehaviorByName('drag')
      ?.onDragStartObservable.addOnce(() => this.pop())
  }

  pop() {
    if (!this.next) {
      return
    }
    this.next.position.y = 0
    this.next = null
  }
}
