import Babylon from 'babylonjs'
import { TargetBehavior } from './targetable'
import { dragManager, multiSelectionManager } from '../managers'
import { animateMove, getTargetableBehavior } from '../utils'
const { Vector3 } = Babylon

function pushOnStack(behavior, mesh) {
  const base = behavior.base || behavior
  const { moveDuration, stack } = base
  enableLastTarget(stack, false)
  setBase(mesh, base)
  stack.push(mesh)
  console.log(`++ stack ${stack.map(({ id }) => id)}`)
  const { x, z } = stack[0].absolutePosition
  animateMove(mesh, new Vector3(x, mesh.absolutePosition.y, z), moveDuration)
}

function enableLastTarget(stack, enabled) {
  const targetable = getTargetableBehavior(stack[stack.length - 1])
  if (targetable) {
    targetable.enabled = enabled
    console.log(
      `!! ${enabled ? 'enable' : 'disable'} target for ${
        stack[stack.length - 1].id
      }`
    )
  }
}

function setBase(mesh, base) {
  const targetable = getTargetableBehavior(mesh)
  if (targetable) {
    targetable.base = base
  }
}

export class StackBehavior extends TargetBehavior {
  constructor({ moveDuration } = {}) {
    super()
    this.moveDuration = moveDuration || 0.1
    this.dropObserver = null
    this.stack = []
    this.base = null
    dragManager.onDragStartObservable.add(({ mesh }) => {
      // pop the last item if it's dragged, unless:
      // 1. there's only one item
      // 2. the first item is also dragged (we're dragging the whole stack)
      const { stack } = this
      if (stack.length > 1) {
        if (
          mesh === stack[stack.length - 1] &&
          !multiSelectionManager.meshes.includes(stack[0])
        ) {
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
    if (!mesh || (this.base || this).stack.includes(mesh)) {
      return
    }
    const stackBehavior = mesh.getBehaviorByName(StackBehavior.NAME)
    if (stackBehavior) {
      for (const mesh of stackBehavior.stack) {
        pushOnStack(this, mesh)
      }
      stackBehavior.stack = [stackBehavior.stack[0]]
    } else {
      pushOnStack(this, mesh)
    }
  }

  pop() {
    const { stack } = this
    if (stack.length <= 0) {
      return
    }
    const mesh = stack.pop()
    setBase(mesh, null)
    enableLastTarget(stack, true)
    console.log(`-- stack ${stack.map(({ id }) => id)}`)
    return mesh
  }
}

StackBehavior.NAME = 'stackable'
