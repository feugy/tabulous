// @ts-check
import { Vector3 } from '@babylonjs/core/Maths/math.vector'

import { makeLogger } from '../../utils/logger'
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

/** @typedef {import('@tabulous/types').QuantifiableState & Required<Pick<import('@tabulous/types').QuantifiableState, 'duration'|'quantity'|'extent'>>} RequiredQuantifiableState */

const logger = makeLogger(QuantityBehaviorName)

export class QuantityBehavior extends TargetBehavior {
  /**
   * Creates behavior to make a mesh quantifiable (one can increments or decrements its quantity)
   * and targetable (one can drop other quantifiable meshs).
   * Dropped meshes are destroyed while quantity is incremented.
   * Poped meshes are created on the fly, except when the quantity is 1.
   * @param {import('@tabulous/types').QuantifiableState} state - behavior state.
   * @param {import('../managers').Managers} managers - current managers.
   */
  constructor(state, managers) {
    super({}, managers)
    /** the behavior's current state. */
    this.state = /** @type {RequiredQuantifiableState} */ (state)
    /** @protected @type {?import('@babylonjs/core').Observer<import('../managers').PreMoveDetails>} */
    this.preMoveObserver = null
    /** @protected @type {?import('@babylonjs/core').Observer<import('../managers').DropDetails>} */
    this.dropObserver = null
    /** @protected @type {import('../managers').DropZone}} */
    this.dropZone
  }

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
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    super.attach(mesh)
    this.fromState(this.state)

    this.dropObserver = this.onDropObservable.add(
      ({ dropped, immediate, isLocal }) => {
        const ids = []
        for (const mesh of dropped) {
          if (this.canIncrement(mesh)) {
            ids.push(mesh.id)
          }
        }
        internalIncrement(this, ids, immediate ?? false, isLocal)
      }
    )

    this.preMoveObserver = this.managers.move.onPreMoveObservable.add(
      ({ meshes }) => {
        if (
          this.mesh &&
          !this.managers.selection.meshes.has(this.mesh) &&
          meshes.some(({ id }) => id === this.mesh?.id) &&
          this.state.quantity > 1
        ) {
          this.managers.move.exclude(this.mesh)
          this.decrement().then(mesh => this.managers.move.include(mesh))
        }
      }
    )
  }

  /**
   * Detaches this behavior from its mesh, unsubscribing observables
   */
  detach() {
    this.managers.move.onPreMoveObservable.remove(this.preMoveObserver)
    this.onDropObservable?.remove(this.dropObserver)
    super.detach()
  }

  /**
   * Determines whether a movable mesh can increment the current one.
   * @param {import('@babylonjs/core').Mesh} mesh - tested (movable) mesh.
   * @returns true if this mesh can increment.
   */
  canIncrement(mesh) {
    return (
      Boolean(mesh) &&
      Boolean(mesh.getBehaviorByName(QuantityBehaviorName)) &&
      this.managers.target.canAccept(
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
   */
  async increment(meshIds, immediate = false) {
    await internalIncrement(this, meshIds, immediate)
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
   * @returns the created mesh, if any.
   */
  async decrement(count = 1, withMove = false) {
    const { mesh, state } = this
    /** @type {?import('@babylonjs/core').Mesh} */
    let created = null
    if (!mesh || state.quantity === 1) return created
    const createdId = makeId(mesh)
    const duration = withMove ? state.duration : undefined
    this.managers.control.record({
      mesh,
      fn: actionNames.decrement,
      args: [count, withMove],
      duration,
      // undo by incrementing created id with potential animation
      revert: [createdId, withMove],
      isLocal: false
    })

    const quantity = Math.min(count, state.quantity - 1)
    state.quantity -= quantity

    const serialized =
      /** @type {import('@tabulous/types').Mesh & { quantifiable: RequiredQuantifiableState }} */ (
        mesh.metadata.serialize()
      )
    serialized.quantifiable.quantity = quantity
    serialized.id = createdId
    created = /** @type {import('@babylonjs/core').Mesh} */ (
      await createMeshFromState(serialized, mesh.getScene(), this.managers)
    )

    logger.info(
      { mesh, oldQuantity: state.quantity, created, quantity },
      `decrement ${created.id} (remains: ${state.quantity}) from ${mesh.id} (has: ${quantity})`
    )
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
    updateIndicator(this.managers, mesh, state.quantity)
    return move ? move.then(() => created) : created
  }

  /**
   * Revert increment and decrement actions. Ignores other actions
   * @param {import('@tabulous/types').ActionName} action - reverted action.
   * @param {any[]} [args] - reverted arguments.
   */
  async revert(action, args = []) {
    if (!this.mesh || args.length !== 2) {
      return
    }
    if (action === actionNames.increment) {
      const [states, withMove] = args
      const {
        mesh,
        state: { duration }
      } = this
      const scene = mesh.getScene()
      await Promise.all(
        states.map(
          async (/** @type {import('@tabulous/types').Mesh} */ state) => {
            const count = state.quantifiable?.quantity ?? 1
            this.managers.control.record({
              mesh,
              fn: actionNames.decrement,
              args: [count, withMove],
              duration,
              revert: [state.id, withMove],
              isLocal: true
            })
            this.state.quantity -= count
            const created = await createMeshFromState(
              state,
              scene,
              this.managers
            )
            if (withMove) {
              created.setAbsolutePosition(mesh.absolutePosition)
              await animateMove(
                created,
                Vector3.FromArray([state.x ?? 0, state.y ?? 0, state.z ?? 0]),
                null,
                duration
              )
            }
          }
        )
      )
      updateIndicator(this.managers, mesh, this.state.quantity)
    } else if (action === actionNames.decrement) {
      await internalIncrement(this, [args[0]], args[1], true)
    }
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {import('@tabulous/types').QuantifiableState} state - state to update to.
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
    updateIndicator(this.managers, this.mesh, quantity)
    // dispose previous drop zone
    if (this.dropZone) {
      this.removeZone(
        /** @type {import('../managers').SingleDropZone} */ (this.dropZone)
      )
    }
    this.dropZone = this.addZone(
      buildTargetMesh(`quantifiable-zone-${this.mesh.id}`, this.mesh),
      this.state
    )

    attachFunctions(this, 'increment', 'decrement', 'canIncrement')
    attachProperty(this, 'quantity', () => this.state.quantity)
  }
}

async function internalIncrement(
  /** @type {QuantityBehavior} */ { mesh, state, managers },
  /** @type {string[]} */ meshIds,
  /** @type {boolean} */ immediate,
  isLocal = false
) {
  const meshes = /** @type {import('@babylonjs/core').Mesh[]} */ (
    meshIds?.map(id => mesh?.getScene().getMeshById(id)).filter(Boolean)
  )
  if (!meshes.length || !mesh) return

  const duration = immediate ? 0 : state.duration

  managers.control.record({
    mesh,
    fn: actionNames.increment,
    args: [meshIds, immediate],
    duration,
    // undo by decrementing and restoring states with potential animation
    revert: [meshes.map(({ metadata }) => metadata.serialize()), immediate],
    isLocal
  })

  for (const other of meshes) {
    const increment = getQuantity(other)
    logger.info(
      { mesh, increment, other },
      `increment ${mesh.id} by ${increment} with ${other.id}`
    )
    state.quantity += increment
    updateIndicator(managers, mesh, state.quantity)
    if (duration) {
      await animateMove(other, mesh.absolutePosition, null, duration)
    }
    other.dispose()
  }
}

function getQuantity(/** @type {import('@babylonjs/core').Mesh} */ mesh) {
  return mesh.metadata?.quantity ?? 1
}

function updateIndicator(
  /** @type {import('../managers').Managers} */ { indicator },
  /** @type {import('@babylonjs/core').Mesh} */ mesh,
  /** @type {number} */ size
) {
  const id = `${mesh.id}.quantity`
  if (size > 1) {
    indicator.registerMeshIndicator({ id, mesh, size })
  } else {
    indicator.unregisterIndicator({ id })
  }
}

function makeId(/** @type {import('@babylonjs/core').Mesh} */ mesh) {
  return `${mesh.id}-${crypto.randomUUID()}`
}
