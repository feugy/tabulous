import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import { makeLogger } from '../../utils/logger'
import { controlManager } from '../managers/control'
import { indicatorManager } from '../managers/indicator'
import { moveManager } from '../managers/move'
import { selectionManager } from '../managers/selection'
import { targetManager } from '../managers/target'
import {
  animateMove,
  attachFunctions,
  attachProperty,
  buildTargetMesh
} from '../utils/behaviors'
import { getCenterAltitudeAbove } from '../utils/gravity'
import { createMeshFromState } from '../utils/scene-loader'
import { MoveBehaviorName, QuantityBehaviorName } from './names'
import { TargetBehavior } from './targetable'

const logger = makeLogger('quantifiable')

/**
 * @typedef {object} QuantifiableState behavior persistent state, including:
 * @property {number} quantity - number of items, including this one.
 * @property {string[]} kinds? - an optional array of allowed drag kinds for this zone (allows all if not specified).
 * @property {number} priority? - priority applied when multiple targets with same altitude apply.
 * @property {number} enabled? - priority applied when multiple targets with same altitude apply.
 * @property {number} [duration=100] - duration (in milliseconds) when pushing individual meshes.
 * @property {number} [extent=2] - allowed distance between mesh and stack center when dropping.
 */

export class QuantityBehavior extends TargetBehavior {
  /**
   * Creates behavior to make a mesh quantifiable (one can increments or decrements its quantity)
   * and targetable (one can drop other quantifiable meshs).
   * Dropped meshes are destroyed while quantity is incremented.
   * Poped meshes are created on the fly, except when the quantity is 1.
   *
   * @extends {TargetBehavior}
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {QuantifiableState} state - the behavior's current state.
   *
   * @param {QuantifiableState} state - behavior state.
   */
  constructor(state = {}) {
    super()
    this.state = state
    // private
    this.preMoveObserver = null
    this.dropObserver = null
    this.dropZone = null
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return QuantityBehaviorName
  }

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - a `quantity` number (minimym 1).
   * - a `increment()` function to programmatically increment the quantity.
   * - a `decrement()` function to programmatically decrement the quantity.
   * - a `canIncrement()` function to determin whether a mesh could increment the quantity.
   * It binds to its drop observable to increment when dropping meshes.
   * It binds to the drag manager drag observable to decrement (unless quantity is 1).
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
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

    this.preMoveObserver = moveManager.onPreMoveObservable.add(moved => {
      const index = moved.findIndex(({ id }) => id === this.mesh?.id)
      if (
        !selectionManager.meshes.has(this.mesh) &&
        index !== -1 &&
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
   * @param {import('@babel/core').Mesh} mesh - tested (movable) mesh.
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
   *
   * @async
   * @param {string[]} meshIds - ids of the pushed mesh.
   * @param {boolean} [immediate=false] - set to true to disable animation.
   */
  async increment(meshIds, immediate = false) {
    const { mesh } = this
    const meshes = meshIds
      ?.map(id => mesh.getScene().getMeshById(id))
      .filter(Boolean)
    if (!meshes.length) return

    const duration = immediate ? 0 : this.state.duration

    controlManager.record({
      mesh,
      fn: 'increment',
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
        await animateMove(other, mesh.absolutePosition, duration)
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
   * @async
   * @param {number} [amount=1] - amount to decrement.
   * @param {boolean} [withMove=false] - when set to true, moves the created meshes aside this one.
   * @return {import('@babylonjs/core').Mesh} the created mesh, if any.
   */
  async decrement(count = 1, withMove = false) {
    const { mesh, state } = this
    let created = null
    if (state.quantity === 1) return created
    const quantity = Math.min(count, state.quantity - 1)
    state.quantity -= quantity

    const serialized = mesh.metadata.serialize()
    serialized.quantifiable.quantity = quantity
    serialized.id = makeId(mesh)
    created = await createMeshFromState(serialized, mesh.getScene())

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
          created.absolutePosition.x,
          getCenterAltitudeAbove(mesh, created),
          created.absolutePosition.z
        ),
        duration,
        true
      )
    }
    updateIndicator(mesh, state.quantity)
    controlManager.record({
      mesh,
      fn: 'decrement',
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
      this.removeZone(this.dropZone)
    }
    this.dropZone = this.addZone(
      buildTargetMesh('drop-zone', this.mesh),
      this.state
    )

    attachFunctions(this, 'increment', 'decrement', 'canIncrement')
    attachProperty(this, 'quantity', () => this.state.quantity)
  }
}

function getQuantity(mesh) {
  return mesh.metadata?.quantity ?? 1
}

function updateIndicator(mesh, size) {
  const id = `${mesh.id}.quantity`
  if (size > 1) {
    indicatorManager.registerMeshIndicator({ id, mesh, size })
  } else {
    indicatorManager.unregisterIndicator({ id })
  }
}

function makeId(mesh) {
  return `${mesh.id}-${crypto.randomUUID()}`
}
