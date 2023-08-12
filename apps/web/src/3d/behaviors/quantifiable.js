// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@tabulous/server/src/graphql').QuantifiableState} QuantifiableState
 * @typedef {import('@tabulous/server/src/graphql').Mesh} SerializedMesh
 * @typedef {import('@src/3d/behaviors/targetable').DropZone} DropZone
 * @typedef {import('@src/3d/behaviors/targetable').SingleDropZone} SingleDropZone
 * @typedef {import('@src/3d/behaviors/targetable').DropDetails} DropDetails
 * @typedef {import('@src/3d/managers/move').PreMoveDetails} PreMoveDetails
 */
/**
 * @template T
 * @typedef {import('@babylonjs/core').Observer<T>} Observer
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'

import { makeLogger } from '../../utils/logger'
import { controlManager } from '../managers/control'
import { indicatorManager } from '../managers/indicator'
import { moveManager } from '../managers/move'
import { selectionManager } from '../managers/selection'
import { targetManager } from '../managers/target'
import { actionNames } from '../utils/actions'
import {
  animateMove,
  attachFunctions,
  attachProperty,
  buildTargetMesh
} from '../utils/behaviors'
import { createMeshFromState } from '../utils/scene-loader'
import { MoveBehaviorName, QuantityBehaviorName } from './names'
import { TargetBehavior } from './targetable'

/** @typedef {QuantifiableState & Required<Pick<QuantifiableState, 'duration'|'quantity'|'extent'>>} RequiredQuantifiableState */

const logger = makeLogger('quantifiable')

export class QuantityBehavior extends TargetBehavior {
  /**
   * Creates behavior to make a mesh quantifiable (one can increments or decrements its quantity)
   * and targetable (one can drop other quantifiable meshs).
   * Dropped meshes are destroyed while quantity is incremented.
   * Poped meshes are created on the fly, except when the quantity is 1.
   * @param {QuantifiableState} state - behavior state.
   */
  constructor(state = {}) {
    super()
    /** @type {RequiredQuantifiableState} state - the behavior's current state. */
    this.state = /** @type {RequiredQuantifiableState} */ (state)
    /** @protected @type {?Observer<PreMoveDetails>} */
    this.preMoveObserver = null
    /** @protected @type {?Observer<DropDetails>} */
    this.dropObserver = null
    /** @protected @type {DropZone}} */
    this.dropZone
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return QuantityBehaviorName
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - a `quantity` number (minimum 1).
   * - a `increment()` function to programmatically increment the quantity.
   * - a `decrement()` function to programmatically decrement the quantity.
   * - a `canIncrement()` function to determin whether a mesh could increment the quantity.
   * It binds to its drop observable to increment when dropping meshes.
   * It binds to the drag manager drag observable to decrement (unless quantity is 1).
   * @param {Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this.state)

    this.dropObserver = this.onDropObservable.add(({ dropped, immediate }) => {
      const ids = []
      for (const mesh of dropped) {
        if (this.canIncrement(mesh)) {
          ids.push(mesh.id)
        }
      }
      this.increment(ids, immediate)
    })

    this.preMoveObserver = moveManager.onPreMoveObservable.add(({ meshes }) => {
      if (
        this.mesh &&
        !selectionManager.meshes.has(this.mesh) &&
        meshes.some(({ id }) => id === this.mesh?.id) &&
        this.state.quantity > 1
      ) {
        moveManager.exclude(this.mesh)
        this.decrement().then(mesh => moveManager.include(mesh))
      }
    })
  }

  /**
   * Detaches this behavior from its mesh, unsubscribing observables
   */
  detach() {
    moveManager.onPreMoveObservable.remove(this.preMoveObserver)
    this.onDropObservable?.remove(this.dropObserver)
    super.detach()
  }

  /**
   * Determines whether a movable mesh can increment the current one.
   * @param {Mesh} mesh - tested (movable) mesh.
   * @returns {boolean} true if this mesh can increment.
   */
  canIncrement(mesh) {
    return (
      Boolean(mesh) &&
      Boolean(mesh.getBehaviorByName(QuantityBehaviorName)) &&
      targetManager.canAccept(
        this.dropZone,
        mesh.getBehaviorByName(MoveBehaviorName)?.state.kind
      )
    )
  }

  /**
   * Increments the quantity by adding other meshes:
   * - records the action into the control manager
   * - runs a move animation
   * - runs a scale animation
   * - destroy corresponding meshes
   * @param {string[]} meshIds - ids of the pushed mesh.
   * @param {boolean} [immediate=false] - set to true to disable animation.
   * @returns {Promise<void>}
   */
  async increment(meshIds, immediate = false) {
    const { mesh } = this
    const meshes = /** @type {Mesh[]} */ (
      meshIds?.map(id => mesh?.getScene().getMeshById(id)).filter(Boolean)
    )
    if (!meshes.length || !mesh) return

    const duration = immediate ? 0 : this.state.duration

    controlManager.record({
      mesh,
      fn: actionNames.increment,
      args: [meshIds, immediate],
      duration
    })

    for (const other of meshes) {
      const increment = getQuantity(other)
      logger.info(
        { mesh, increment, other },
        `increment ${mesh.id} by ${increment} with ${other.id}`
      )
      this.state.quantity += increment
      updateIndicator(mesh, this.state.quantity)
      if (duration) {
        await animateMove(other, mesh.absolutePosition, null, duration)
      }
      other.dispose()
    }
  }

  /**
   * Drecrements quantity by creating another mesh:
   * - decrements quantity
   * - creates new meshes accordingly
   * - moves them aside (when relevant)
   * - records the action into the control manager
   * It can not decrement a quantity of 1, nor decrement more than the available quantity
   *
   * @param {number} [count=1] - amount to decrement.
   * @param {boolean} [withMove=false] - when set to true, moves the created meshes aside this one.
   * @returns {Promise<?Mesh>} the created mesh, if any.
   */
  async decrement(count = 1, withMove = false) {
    const { mesh, state } = this
    /** @type {?Mesh} */
    let created = null
    if (!mesh || state.quantity === 1) return created
    const quantity = Math.min(count, state.quantity - 1)
    state.quantity -= quantity

    const serialized =
      /** @type {SerializedMesh & { quantifiable: RequiredQuantifiableState }} */ (
        mesh.metadata.serialize()
      )
    serialized.quantifiable.quantity = quantity
    serialized.id = makeId(mesh)
    created = /** @type {Mesh} */ (
      await createMeshFromState(serialized, mesh.getScene())
    )

    logger.info(
      { mesh, oldQuantity: state.quantity, created, quantity },
      `decrement ${created.id} (remains: ${state.quantity}) from ${mesh.id} (has: ${quantity})`
    )
    const duration = withMove ? state.duration : undefined
    let move
    if (duration) {
      move = animateMove(
        created,
        new Vector3(
          mesh.getBoundingInfo().boundingBox.maximumWorld.x + 0.5,
          created.absolutePosition.y,
          created.absolutePosition.z
        ),
        null,
        duration,
        true
      )
    }
    updateIndicator(mesh, state.quantity)
    controlManager.record({
      mesh,
      fn: actionNames.decrement,
      args: [count, withMove],
      duration
    })
    return move ? move.then(() => created) : created
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {QuantifiableState} state - state to update to.
   */
  fromState({
    quantity = 1,
    extent = 2,
    duration = 100,
    kinds,
    priority
  } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this.state = { quantity, kinds, priority, extent, duration }
    updateIndicator(this.mesh, quantity)
    // dispose previous drop zone
    if (this.dropZone) {
      this.removeZone(/** @type {SingleDropZone} */ (this.dropZone))
    }
    this.dropZone = this.addZone(
      buildTargetMesh('drop-zone', this.mesh),
      this.state
    )

    attachFunctions(this, 'increment', 'decrement', 'canIncrement')
    attachProperty(this, 'quantity', () => this.state.quantity)
  }
}

/**
 * @param {Mesh} mesh - updated mesh.
 * @returns {number} mesh's quantity.
 */
function getQuantity(mesh) {
  return mesh.metadata?.quantity ?? 1
}

/**
 * @param {Mesh} mesh - updated mesh.
 * @param {number} size - new indicator's size.
 */
function updateIndicator(mesh, size) {
  const id = `${mesh.id}.quantity`
  if (size > 1) {
    indicatorManager.registerMeshIndicator({ id, mesh, size })
  } else {
    indicatorManager.unregisterIndicator({ id })
  }
}

/**
 * @param {Mesh} mesh - mesh to generate Id from.
 * @returns {string} generated Id.
 */
function makeId(mesh) {
  return `${mesh.id}-${crypto.randomUUID()}`
}
