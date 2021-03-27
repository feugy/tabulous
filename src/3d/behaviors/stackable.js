import Babylon from 'babylonjs'
import { TargetBehavior } from './targetable'
import { controlManager, dragManager, multiSelectionManager } from '../managers'
import {
  altitudeOnTop,
  animateMove,
  getHeight,
  getTargetableBehavior
} from '../utils'
import { makeLogger } from '../../utils'

const { Vector3 } = Babylon
const logger = makeLogger('stackable')

function pushOnStack(base) {
  const { moveDuration, stack, pushQueue } = base
  const { mesh, onEnd } = pushQueue[0]
  controlManager.record({ meshId: stack[0].id, fn: 'push', args: [mesh.id] })
  const { x, z } = stack[0].absolutePosition
  const y = altitudeOnTop(mesh, stack[stack.length - 1])
  logger.debug(
    { stack, mesh, x, y, z },
    `push ${mesh.id} on stack ${stack.map(({ id }) => id)}`
  )
  enableLastTarget(stack, false)
  setBase(mesh, base)
  stack.push(mesh)
  animateMove(mesh, new Vector3(x, y, z), moveDuration, () => {
    pushQueue.shift()
    if (onEnd) {
      onEnd(mesh)
    }
    if (pushQueue.length) {
      pushOnStack(base)
    }
  })
}

function enableLastTarget(stack, enabled) {
  const mesh = stack[stack.length - 1]
  const targetable = getTargetableBehavior(mesh)
  if (targetable) {
    targetable.enabled = enabled
    logger.debug(
      { mesh },
      `${enabled ? 'enable' : 'disable'} target for ${mesh.id}`
    )
  }
}

function setBase(mesh, base) {
  const targetable = getTargetableBehavior(mesh)
  if (targetable) {
    targetable.base = base
    targetable.stack = [mesh]
    targetable.mesh.metadata.stack = base?.stack
    targetable.mesh.metadata.shuffle = base
      ? ids => base.shuffle(ids)
      : () => {}
  }
}

export class StackBehavior extends TargetBehavior {
  constructor({ moveDuration } = {}) {
    super()
    this.moveDuration = moveDuration || 0.1
    this.dropObserver = null
    this.stack = []
    this.base = null
    this.pushQueue = []
    dragManager.onDragStartObservable.add(({ mesh }) => {
      // pop the last item if it's dragged, unless:
      // 1. there's only one item
      // 2. the first item is also dragged (we're dragging the whole stack)
      const { stack } = this
      if (
        stack.length > 1 &&
        stack[stack.length - 1] === mesh &&
        !multiSelectionManager.meshes.includes(stack[0])
      ) {
        this.pop()
      }
    })
  }

  get name() {
    return StackBehavior.NAME
  }

  attach(mesh) {
    super.attach(mesh)
    this.stack = [mesh]
    if (!mesh.metadata) {
      mesh.metadata = {}
    }
    mesh.metadata.stack = this.base?.stack
    mesh.metadata.push = id => this.push(id)
    mesh.metadata.pop = () => this.pop()
    mesh.metadata.shuffle = () => {}
    this.dropObserver = this.onDropObservable.add(({ dragged }) =>
      this.push(dragged?.id)
    )
    // TODO automatically define target, and disable function
  }

  detach() {
    this.onDropObservable?.remove(this.dropObserver)
    super.detach()
  }

  push(meshId, onEnd = null) {
    const mesh = this.stack[0].getScene().getMeshByID(meshId)
    if (!mesh || (this.base || this).stack.includes(mesh)) {
      return
    }
    const base = this.base || this
    base.pushQueue.push({ mesh, onEnd })
    if (base.pushQueue.length === 1) {
      pushOnStack(base)
    }
  }

  pop() {
    const { stack } = this
    if (stack.length <= 1) {
      return
    }
    const mesh = stack.pop()
    setBase(mesh, null)
    enableLastTarget(stack, true)
    logger.debug(
      { stack, mesh },
      `pop ${mesh.id} out of stack ${stack.map(({ id }) => id)}`
    )
    controlManager.record({ meshId: stack[0].id, fn: 'pop' })
    return mesh
  }

  async shuffle(ids) {
    if (this.stack.length <= 1) {
      return
    }
    const posById = new Map(this.stack.map(({ id }, i) => [id, i]))
    const stack = ids.map(id => this.stack[posById.get(id)])

    controlManager.record({ meshId: stack[0].id, fn: 'shuffle', args: [ids] })

    // move the new base card to its final position to allow stack computations
    const basePosition = this.mesh.absolutePosition.clone()
    basePosition.y += getHeight(stack[0]) - getHeight(this.mesh)
    stack[0].setAbsolutePosition(basePosition)

    logger.debug(
      { old: this.stack, stack, base: basePosition },
      `shuffle\n${this.stack.map(({ id }) => id)}\nto\n${ids}`
    )

    let last = null
    for (const mesh of stack) {
      if (last) {
        const { x, z } = mesh.absolutePosition
        mesh.setAbsolutePosition(new Vector3(x, altitudeOnTop(mesh, last), z))
      }
      last = mesh
    }

    // first, explode
    await new Promise(resolve => {
      let completed = 0
      const distance =
        stack[0].getBoundingInfo().boundingBox.extendSizeWorld.x * 1.5
      const increment = (2 * Math.PI) / stack.length
      let i = 0
      for (const mesh of stack) {
        animateMove(
          mesh,
          mesh.absolutePosition.add(
            new Vector3(
              Math.sin(i * increment) * distance,
              0,
              Math.cos(i * increment) * distance
            )
          ),
          this.moveDuration * 2,
          () => {
            if (++completed === stack.length) {
              resolve()
            }
          }
        )
        i++
      }
    })

    // then reorder internal stack, which will animate to final positions
    await new Promise(resolve => {
      const baseBehavior = stack[0].getBehaviorByName(StackBehavior.NAME)
      const durationSave = baseBehavior.moveDuration
      baseBehavior.moveDuration = Math.max(
        (durationSave * 4) / stack.length,
        0.02
      )
      baseBehavior.base = null
      baseBehavior.stack = [stack[0]]
      enableLastTarget(stack, true)

      animateMove(stack[0], basePosition, this.moveDuration, () => {
        let completed = 1
        for (const mesh of stack.slice(1)) {
          baseBehavior.push(mesh.id, () => {
            if (++completed === stack.length) {
              baseBehavior.moveDuration = durationSave
              resolve()
            }
          })
        }
      })
    })
  }

  serialize() {
    return {
      stack:
        this.stack.length <= 1 ? [] : this.stack.slice(1).map(({ id }) => id)
    }
  }
}

StackBehavior.NAME = 'stackable'
