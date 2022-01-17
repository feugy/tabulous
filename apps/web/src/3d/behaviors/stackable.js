import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { MoveBehaviorName, StackBehaviorName } from './names'
import { TargetBehavior } from './targetable'
import { controlManager, inputManager, selectionManager } from '../managers'
import {
  altitudeOnTop,
  animateMove,
  applyGravity,
  getTargetableBehavior,
  sortByElevation
} from '../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('stackable')

function enableLast(stack, enabled) {
  const operation = enabled ? 'enable' : 'disable'
  const mesh = stack[stack.length - 1]
  const targetable = getTargetableBehavior(mesh)
  if (targetable) {
    for (const zone of targetable.zones) {
      zone.enabled = enabled
    }
    logger.info({ mesh }, `${operation} target for ${mesh.id}`)
  }
  const movable = mesh.getBehaviorByName(MoveBehaviorName)
  if (movable) {
    movable.enabled = enabled
    logger.info({ mesh }, `${operation} moves for ${mesh.id}`)
  }
  if (enabled) {
    controlManager.registerControlable(mesh)
  } else {
    controlManager.unregisterControlable(mesh)
  }
}

function setBase(mesh, base, stack) {
  const targetable = getTargetableBehavior(mesh)
  if (targetable) {
    targetable.base = base
    targetable.stack = stack
    mesh.metadata.stack = targetable.stack
  }
  return targetable
}

/**
 * @typedef {object} StackableState behavior persistent state, including:
 * @property {string[]} stack - array of stacked mesh ids, not including the current mesh if alone.
 * @property {boolean} isCylindric - indicates whether to use a circular (true) or rectangular (false) drop zone (false.
 * @property {string[]} kinds? - an optional array of allowed drag kinds for this zone (allows all if not present).
 * @property {number} [duration=100] - duration (in milliseconds) when pushing or shuffling individual meshes.
 * @property {number} [extent=0.6] - drop zone extent zone (1 means 100% size).
 */

export class StackBehavior extends TargetBehavior {
  /**
   * Creates behavior to make a mesh stackable (it can be stacked above other stackable mesh)
   * and targetable (it can receive other stackable meshs).
   * Once a mesh is stacked bellow others, it can not be moved independently, and its targets are disabled.
   * Only the highest mesh on stack can be moved (it is automatically poped out) and be targeted.
   *
   * @extends {TargetBehavior}
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {import('@babylonjs/core').Mesh[]} stack - array of meshes (initially contains this mesh).
   * @property {StackableState} state - the behavior's current state.
   *
   * @param {StackableState} state - behavior state.
   */
  constructor(state = {}) {
    super()
    this._state = state
    this.stack = []
    // private
    this.dragObserver = null
    this.dropObserver = null
    this.base = null
    this.pushQueue = []
    this.inhibitControl = false
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return StackBehaviorName
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - a `stack` array of meshes (initially contains this mesh).
   * - a `push()` function to programmatically drop another mesh onto the stack.
   * - a `pop()` function to programmatically pop the highest mesh from stack.
   * - a `reorder()` function to re-order the stack with animation.
   * - a `flipAll()` function to flip an entire stack with animation, inverting the stack order.
   * - a `rotateAll()` function to rotate an entire stack with animation.
   * It binds to its drop observable to push dropped meshes to the stack.
   * It binds to the drag manager drag observable to pop the first stacked mesh when dragging it.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    super.attach(mesh)
    controlManager.registerControlable(mesh)
    this.fromState(this._state)

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
   * - records the action into the control manager (if not inhibited)
   * - disables targets and moves of all meshes but the highest one
   * - runs a move animation with gravity until completion
   * - updates the base stack array
   * Does nothing if the mesh is already on stack (or unknown).
   *
   * @async
   * @param {string} meshId - id of the pushed mesh.
   */
  async push(meshId) {
    const mesh = this.stack[0].getScene().getMeshById(meshId)
    if (!mesh || this.stack.includes(mesh)) return

    const base = this.base ?? this
    const { stack } = base

    if (!this.inhibitControl) {
      controlManager.record({ meshId: stack[0].id, fn: 'push', args: [meshId] })
    }
    const { x, z } = stack[0].absolutePosition
    const y = altitudeOnTop(mesh, stack[stack.length - 1])
    logger.info(
      { stack, mesh, x, y, z },
      `push ${mesh.id} on stack ${stack.map(({ id }) => id)}`
    )
    enableLast(stack, false)
    setBase(mesh, base, stack)
    stack.push(mesh)
    await animateMove(
      mesh,
      new Vector3(x, y, z),
      this.inhibitControl ? 0 : this._state.duration,
      true
    )
  }

  /**
   * Pops the highest mesh from this stack:
   * - updates the stack array
   * - disables targets and moves of all meshes but the highest one
   * - records the action into the control manager
   *
   * @return {import('@babylonjs/core').Mesh} the poped mesh, if any.
   */
  pop() {
    const stack = this.base?.stack ?? this.stack
    if (stack.length <= 1) return

    const mesh = stack.pop()
    setBase(mesh, null, [mesh])
    // note: no need to enable the poped mesh target: since it was last, it's always enabled
    enableLast(stack, true)
    logger.info(
      { stack, mesh },
      `pop ${mesh.id} out of stack ${stack.map(({ id }) => id)}`
    )
    // note: all mesh in stack are uncontrollable, so we pass the poped mesh id
    controlManager.record({ meshId: stack[0].id, fn: 'pop' })
    return mesh
  }

  /**
   * Reorders the stack, with a possible animation:
   * - records the action into the control manager
   * - updates each mesh's base and stack, including metadata, according to new order
   * - disables targets and moves of all meshes but the highest one
   * - moves each mesh to their final position, applying gravity, with no animation
   * - (when requested) moves in parallel all meshes to "explode" the stack and wait until they complete
   * - (when requestd) moves in serie all meshes to their final position and wait until completion
   *
   * @async
   * @param {string[]} ids - array or mesh ids givin the new order.
   * @param {boolean} [animate = true] - enables visual animation
   */
  async reorder(ids, animate = true) {
    const old = this.base?.stack ?? this.stack
    if (old.length <= 1) return

    const posById = new Map(old.map(({ id }, i) => [id, i]))
    const stack = ids.map(id => old[posById.get(id)])

    controlManager.record({
      meshId: old[0].id,
      fn: 'reorder',
      args: [ids, animate]
    })

    logger.info(
      { old, stack, animate },
      `reorder: ${old.map(({ id }) => id)} into ${ids}`
    )

    // updates stack and base internals
    const baseBehavior = setBase(stack[0], null, stack)
    for (const mesh of stack.slice(1)) {
      setBase(mesh, baseBehavior, stack)
    }
    // updates targets
    enableLast(old, false)
    enableLast(stack, true)

    for (const mesh of stack) {
      // prevents interactions and collisions
      mesh.isPickable = false
    }

    let last = null
    const newPositions = []
    // moves meshes to their final position
    for (const mesh of stack) {
      if (!last) {
        applyGravity(mesh)
        newPositions.push(mesh.absolutePosition.clone())
      } else {
        const { x, z } = mesh.absolutePosition
        const position = new Vector3(x, altitudeOnTop(mesh, last), z)
        mesh.setAbsolutePosition(position)
        newPositions.push(position)
      }
      last = mesh
    }

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
            this._state.duration * 2
          ).then(() => {
            // animateMove re-enabled interactions and collisions
            mesh.isPickable = false
          })
        )
      )
      // then animate all cards to final positions
      const duration = Math.max((this._state.duration * 4) / stack.length, 0.02)
      for (const [i, mesh] of stack.entries()) {
        await animateMove(mesh, newPositions[i], duration)
      }
    }
    for (const mesh of stack) {
      mesh.isPickable = true
    }
  }

  /**
   * Flips entire stack:
   * - flips in parallel each mesh
   * - re-order the stack so the lowest mesh becomes the highest
   * - disables targets and moves of all meshes but the highest one
   * @async
   */
  async flipAll() {
    const base = this.base ?? this
    // we need to wait before reordering that cards reached their new place
    await Promise.all(base.stack.map(mesh => mesh.metadata.flip?.()))
    base.reorder(base.stack.map(({ id }) => id).reverse(), false)
  }

  /**
   * Rotates entire stack (each mesh in parallel).
   * @async
   */
  async rotateAll() {
    const base = this.base ?? this
    await Promise.all(base.stack.map(mesh => mesh.metadata.rotate?.()))
  }

  /**
   * Gets this behavior's state.
   * @returns {StackableState} this behavior's state for serialization.
   */
  get state() {
    return {
      duration: this._state.duration,
      extent: this._state.extent,
      kinds: this._state.kinds,
      isCylindric: this._state.isCylindric,
      stack:
        this.base !== null || this.stack.length <= 1
          ? []
          : this.stack.slice(1).map(({ id }) => id)
    }
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {StackableState} state - state to update to.
   */
  fromState({
    stack = [],
    extent = 0.3,
    duration = 100,
    kinds,
    isCylindric
  } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this._state = { stack, kinds, isCylindric, extent, duration }

    this.stack = [this.mesh]
    // dispose previous drop zone
    for (const zone of this.zones) {
      this.removeZone(zone)
    }
    // builds a drop zone from the mesh's dimensions
    const { x, y, z } = this.mesh.getBoundingInfo().boundingBox.extendSizeWorld
    const dropZone = this._state.isCylindric
      ? CreateCylinder('drop-zone', { diameter: x * 2, height: y * 2 })
      : CreateBox('drop-zone', { width: x * 2, height: y * 2, depth: z * 2 })
    dropZone.parent = this.mesh
    this.addZone(dropZone, this._state.extent, this._state.kinds)

    if (Array.isArray(this._state.stack)) {
      this.inhibitControl = true
      for (const id of this._state.stack) {
        this.push(id)
      }
      this.inhibitControl = false
    }

    if (!this.mesh.metadata) {
      this.mesh.metadata = {}
    }
    this.mesh.metadata.stack = this.stack
    this.mesh.metadata.push = this.push.bind(this)
    this.mesh.metadata.pop = this.pop.bind(this)
    this.mesh.metadata.reorder = this.reorder.bind(this)
    this.mesh.metadata.flipAll = this.flipAll.bind(this)
    this.mesh.metadata.rotateAll = this.rotateAll.bind(this)
  }
}
