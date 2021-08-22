import { Vector3 } from '@babylonjs/core'
import { TargetBehavior } from './targetable'
import { controlManager, inputManager, selectionManager } from '../managers'
import {
  altitudeOnTop,
  animateMove,
  getHeight,
  getTargetableBehavior
} from '../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('stackable')

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
    targetable.mesh.metadata.reorder = base
      ? ids => base.reorder(ids)
      : () => {}
  }
}

export class StackBehavior extends TargetBehavior {
  /**
   * Creates behavior to make a mesh stackable (it can be stacked above other stackable mesh)
   * and targetable (it can receive other stackable meshs).
   *
   * @extends {TargetBehavior}
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {import('@babylonjs/core').Mesh[]} stack - array of meshes (initially contains this mesh).
   * @property {number} moveDuration - duration (in milliseconds) when pushing or shuffling individual meshes.
   *
   * @param {object} params - parameters, including:
   * @param {number} [params.moveDuration=100] - duration (in milliseconds) of an individual mesh reorder animation.
   */
  constructor({ moveDuration } = {}) {
    super()
    this.stack = []
    this.moveDuration = moveDuration || 100
    // private
    this.dragObserver = null
    this.dropObserver = null
    this.base = null
    this.pushQueue = []
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return StackBehavior.NAME
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - a `stack` array of meshes (initially contains this mesh).
   * - a `push()` function to programmatically drop another mesh onto the stack.
   * - a `pop()` function to programmatically pop the highest mesh from stack.
   * - a `reorder()` function to re-order the stack with animation.
   * It binds to its drop observable to push dropped meshes to the stack.
   * It binds to the drag manager drag observable to pop the first stacked mesh when dragging it.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.stack = [mesh]
    if (!mesh.metadata) {
      mesh.metadata = {}
    }
    mesh.metadata.stack = this.base?.stack
    mesh.metadata.push = id => this.push(id)
    mesh.metadata.pop = () => this.pop()
    mesh.metadata.reorder = () => {}

    this.dropObserver = this.onDropObservable.add(({ dropped }) => {
      // sort all dropped meshes by elevation (lowest first)
      const sorted = [...dropped].sort(
        (a, b) => a.absolutePosition.y - b.absolutePosition.y
      )
      // then push them
      for (const mesh of sorted) {
        this.push(mesh?.id)
      }
    })

    this.dragObserver = inputManager.onDragObservable.add(({ type, mesh }) => {
      // pop the last item if it's dragged, unless:
      // 1. there's only one item
      // 2. the first item is also dragged (we're dragging the whole stack)
      const { stack } = this
      if (
        type === 'dragStart' &&
        stack.length > 1 &&
        stack[stack.length - 1] === mesh &&
        !selectionManager.meshes.has(stack[0])
      ) {
        this.pop()
      }
    })
    // TODO automatically define target?
  }

  /**
   * Detaches this behavior from its mesh, unsubscribing observables
   */
  detach() {
    inputManager.onDragObservable.remove(this.dragObserver)
    this.onDropObservable?.remove(this.dropObserver)
    super.detach()
  }

  /**
   * Pushes a mesh onto this stack, or the base stack if this mesh is already stacked:
   * - records the action into the control manager
   * - disables all targets but the ones of the highest mesh in stack
   * - runs a move animation with gravity until completion
   * - updates the base stack array
   * Does nothing if the mesh is already on stack (or unknown).
   *
   * @async
   * @param {string} meshId - id of the pushed mesh.
   */
  async push(meshId) {
    const mesh = this.stack[0].getScene().getMeshById(meshId)
    if (!mesh || (this.base || this).stack.includes(mesh)) {
      return
    }
    const base = this.base || this
    const { moveDuration, stack } = base

    controlManager.record({ meshId: stack[0].id, fn: 'push', args: [mesh.id] })
    const { x, z } = stack[0].absolutePosition
    const y = altitudeOnTop(mesh, stack[stack.length - 1])
    logger.info(
      { stack, mesh, x, y, z },
      `push ${mesh.id} on stack ${stack.map(({ id }) => id)}`
    )
    enableLastTarget(stack, false)
    setBase(mesh, base)
    stack.push(mesh)
    await animateMove(mesh, new Vector3(x, y, z), moveDuration, true)
  }

  /**
   * Pops the highest mesh from this stack:
   * - updates the stack array
   * - disables all targets but the ones of the highest mesh in stack
   * - records the action into the control manager
   *
   * TODO base stack?
   * @return {import('@babylonjs/core').Mesh} the poped mesh, if any.
   */
  pop() {
    const { stack } = this
    if (stack.length <= 1) {
      return
    }
    const mesh = stack.pop()
    setBase(mesh, null)
    // note: no need to enable the poped mesh target: since it was last, it's always enabled
    enableLastTarget(stack, true)
    logger.info(
      { stack, mesh },
      `pop ${mesh.id} out of stack ${stack.map(({ id }) => id)}`
    )
    controlManager.record({ meshId: stack[0].id, fn: 'pop' })
    return mesh
  }

  /**
   * Reorders the stack:
   * - records the action into the control manager
   * - moves in parallel all meshes to "explode" the stack and wait until they complete
   * - re-order the internal stack according to the provided id array
   * - moves the new lowest mesh back to its position and wait until completed
   * - sequentially push all other mesh in order to animates them.
   * - disables all targets but the ones of the highest mesh in stack
   *
   * TODO base stack?
   * @async
   * @param {string[]} ids - array or mesh ids givin the new order.
   */
  async reorder(ids) {
    if (this.stack.length <= 1) {
      return
    }
    const posById = new Map(this.stack.map(({ id }, i) => [id, i]))
    const stack = ids.map(id => this.stack[posById.get(id)])

    controlManager.record({ meshId: stack[0].id, fn: 'reorder', args: [ids] })

    // move the new base card to its final position to allow stack computations
    const basePosition = this.mesh.absolutePosition.clone()
    basePosition.y += getHeight(stack[0]) - getHeight(this.mesh)
    stack[0].setAbsolutePosition(basePosition)

    logger.info(
      { old: this.stack, stack, base: basePosition },
      `reorder\n${this.stack.map(({ id }) => id)}\nto\n${ids}`
    )

    let last = null
    for (const mesh of stack) {
      // prevents interactions and collisions
      mesh.isPickable = false
      if (last) {
        const { x, z } = mesh.absolutePosition
        mesh.setAbsolutePosition(new Vector3(x, altitudeOnTop(mesh, last), z))
      }
      last = mesh
    }

    // first, explode
    const distance =
      stack[0].getBoundingInfo().boundingBox.extendSizeWorld.x * 1.5
    const increment = (2 * Math.PI) / stack.length
    await Promise.all(
      stack.map((mesh, i) =>
        animateMove(
          mesh,
          mesh.absolutePosition.add(
            new Vector3(
              Math.sin(i * increment) * distance,
              0,
              Math.cos(i * increment) * distance
            )
          ),
          this.moveDuration * 2
        ).then(() => {
          // animateMove re-enabled interactions and collisions
          mesh.isPickable = false
        })
      )
    )

    // then reorder internal stack, which will animate to final positions
    const baseBehavior = stack[0].getBehaviorByName(StackBehavior.NAME)
    const durationSave = baseBehavior.moveDuration
    baseBehavior.moveDuration = Math.max(
      (durationSave * 4) / stack.length,
      0.02
    )
    baseBehavior.base = null
    baseBehavior.stack = [stack[0]]
    enableLastTarget(stack, true)
    await animateMove(stack[0], basePosition, this.moveDuration, true)
    for (const mesh of stack.slice(1)) {
      await baseBehavior.push(mesh.id)
    }
    baseBehavior.moveDuration = durationSave
  }

  /**
   * @typedef {object} StackableState behavior persistent state, including:
   * @property {string[]} stack - array of stacked mesh ids, not including the current mesh if alone.
   */

  /**
   * Gets this behavior's state.
   * @returns {StackableState} this behavior's state for serialization.
   */
  serialize() {
    return {
      stack:
        this.stack.length <= 1 ? [] : this.stack.slice(1).map(({ id }) => id)
    }
  }
}

/**
 * Name of all stackable behaviors.
 * @static
 * @memberof StackBehavior
 * @type {string}
 */
StackBehavior.NAME = 'stackable'
