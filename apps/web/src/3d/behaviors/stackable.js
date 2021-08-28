import { Vector3 } from '@babylonjs/core'
import { TargetBehavior } from './targetable'
import { controlManager, inputManager, selectionManager } from '../managers'
import {
  altitudeOnTop,
  animateMove,
  applyGravity,
  getHeight,
  getTargetableBehavior,
  sortByElevation
} from '../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('stackable')

function enableLastTarget(stack, enabled) {
  const mesh = stack[stack.length - 1]
  const targetable = getTargetableBehavior(mesh)
  if (targetable) {
    targetable.enabled = enabled
    logger.info(
      { mesh },
      `${enabled ? 'enable' : 'disable'} target for ${mesh.id}`
    )
  }
}

function setBase(mesh, base, stack) {
  const targetable = getTargetableBehavior(mesh)
  if (targetable) {
    targetable.base = base
    targetable.stack = stack
    mesh.metadata.stack = targetable.stack
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
    mesh.metadata.stack = this.stack
    mesh.metadata.push = id => this.push(id)
    mesh.metadata.pop = () => this.pop()
    mesh.metadata.reorder = (...args) => this.reorder(...args)

    this.dropObserver = this.onDropObservable.add(({ dropped }) => {
      // sort all dropped meshes by elevation (lowest first)
      for (const mesh of sortByElevation(dropped)) {
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
    setBase(mesh, base, stack)
    stack.push(mesh)
    await animateMove(mesh, new Vector3(x, y, z), moveDuration, true)
  }

  /**
   * Pops the highest mesh from this stack:
   * - updates the stack array
   * - disables all targets but the ones of the highest mesh in stack
   * - records the action into the control manager
   *
   * @return {import('@babylonjs/core').Mesh} the poped mesh, if any.
   */
  pop() {
    const stack = this.base?.stack ?? this.stack
    if (stack.length <= 1) {
      return
    }
    const mesh = stack.pop()
    setBase(mesh, null, [mesh])
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
   * @async
   * @param {string[]} ids - array or mesh ids givin the new order.
   * @param {boolean} [animate = true] - enables visual animation
   */
  async reorder(ids, animate = true) {
    const old = this.base?.stack ?? this.stack
    if (old.length <= 1) {
      return
    }
    const posById = new Map(old.map(({ id }, i) => [id, i]))
    const stack = ids.map(id => old[posById.get(id)])

    controlManager.record({
      meshId: stack[0].id,
      fn: 'reorder',
      args: [ids, animate]
    })

    // move the new base card to its final position to allow stack computations
    const basePosition = this.mesh.absolutePosition.clone()
    basePosition.y += getHeight(stack[0]) - getHeight(this.mesh)
    stack[0].setAbsolutePosition(basePosition)

    logger.info(
      { old, stack, base: basePosition, animate },
      `reorder: ${old.map(({ id }) => id)} into ${ids}`
    )

    enableLastTarget(old, false)
    for (const mesh of stack) {
      // prevents interactions and collisions
      mesh.isPickable = false
    }

    let last = null
    const newPositions = []
    // moves all cards to their final position
    for (const mesh of stack) {
      if (last) {
        const { x, z } = mesh.absolutePosition
        const position = new Vector3(x, altitudeOnTop(mesh, last), z)
        mesh.setAbsolutePosition(position)
        newPositions.push(position)
      } else {
        applyGravity(mesh)
        newPositions.push(mesh.absolutePosition.clone())
      }
      last = mesh
    }

    setBase(stack[0], null, stack)
    const baseBehavior = stack[0].getBehaviorByName(StackBehavior.NAME)
    for (const mesh of stack.slice(1)) {
      setBase(mesh, baseBehavior, stack)
    }
    enableLastTarget(stack, true)

    if (animate) {
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
                i * 0.05,
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
      // then animate all cards to final positions
      const moveDuration = Math.max(
        (baseBehavior.moveDuration * 4) / stack.length,
        0.02
      )
      for (const [i, mesh] of stack.entries()) {
        await animateMove(mesh, newPositions[i], moveDuration)
      }
    } else {
      for (const mesh of stack) {
        mesh.isPickable = true
      }
    }
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
