// @ts-check
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { Observable } from '@babylonjs/core/Misc/observable.js'

import { actionNames } from '../utils/actions'
import { animateMove } from '../utils/behaviors'

/**
 * @typedef {object} RecordedAction applied action to a given mesh:
 * @property {import('@babylonjs/core').Mesh} mesh - modified mesh.
 * @property {import('@tabulous/types').ActionName} fn - name of the applied action.
 * @property {any[]} args - argument array for this action.
 * @property {any[]} [revert] - when action can't be reverted with the same args, specific data required.
 * @property {number} [duration] - optional animation duration, in milliseconds.
 * @property {boolean} [isLocal] - indicates a local action that should not be re-recorded nor sent to peers.
 *
 * @typedef {object} RecordedMove applied action to a given mesh:
 * @property {import('@babylonjs/core').Mesh} mesh - modified mesh.
 * @property {number[]} pos - absolute position.
 * @property {number[]} prev - absolute position before the move.
 * @property {number} [duration] - optional animation duration, in milliseconds.
 *
 * @typedef {object} MeshDetails details of a given mesh.
 * @property {import('../utils').ScreenPosition} position - screen position (2D pixels) of the detailed mesh.
 * @property {string[]} images - list of images for this mesh (could be multiple for stacked meshes).
 */

export class ControlManager {
  /**
   * Creates a manager to remotely control a collection of meshes:
   * - applies actions received to specific meshes
   * - propagates applied actions to observers (with cycle breaker)
   * Clears all observers on scene disposal.
   * Invokes init() before any other function.
   * @param {object} params - parameters, including:
   * @param {import('@babylonjs/core').Scene} params.scene - main scene.
   * @param {import('@babylonjs/core').Scene} params.handScene - scene for meshes in hand.
   */
  constructor({ scene, handScene }) {
    /** @type {Observable<import('@tabulous/types').ActionOrMove>} */
    this.onActionObservable = new Observable()
    /** @type {Observable<?MeshDetails>} emits when displaying details of a given mesh. */
    this.onDetailedObservable = new Observable()
    /** @type {Observable<Map<String, import('@babylonjs/core').Mesh>>} emits the list of controlled meshes. */
    this.onControlledObservable = new Observable()

    /** @internal */
    this.scene = scene
    /** @internal */
    this.handScene = handScene
    /** @internal @type {Map<string, import('@babylonjs/core').Mesh>} */
    this.controlables = new Map()
    // prevents loops when applying an received action
    /** @internal @type {Set<string>} */
    this.localKeys = new Set()
    /** @internal @type {import('.').Managers} */
    this.managers

    this.scene.onDisposeObservable.addOnce(() => {
      this.onActionObservable.clear()
      this.onDetailedObservable.clear()
      this.onControlledObservable.clear()
    })
  }

  /**
   * Initializes with game data and managers
   *
   * @param {object} params - parameters, including:
   * @param {import('.').Managers} params.managers - current managers.
   */
  init({ managers }) {
    this.managers = managers
  }

  /**
   * Registers a new controllable mesh.
   * Does nothing if this mesh is already managed.
   * @param {import('@babylonjs/core').Mesh} mesh - controled mesh (needs at least an id property).
   */
  registerControlable(mesh) {
    this.controlables.set(mesh.id, mesh)
    this.onControlledObservable.notifyObservers(this.controlables)
    mesh.onDisposeObservable.addOnce(() => {
      if (!mesh.isPhantom) {
        this.unregisterControlable(mesh)
      }
    })
  }

  /**
   * Unregisters a controlled mesh.
   * Does nothing on unmanaged mesh.
   * @param {import('@babylonjs/core').Mesh} mesh - controlled mesh (needs at least an id property).
   */
  unregisterControlable(mesh) {
    if (this.controlables.delete(mesh?.id)) {
      this.onControlledObservable.notifyObservers(this.controlables)
    }
  }

  /**
   * @param {import('@babylonjs/core').Mesh} mesh - tested mesh
   * @returns whether this mesh is controlled or not
   */
  isManaging(mesh) {
    return this.controlables.has(mesh?.id)
  }

  /**
   * Records an actions from one of the controlled meshes, and notifies observers.
   * Does nothing if the source mesh is not controlled.
   * @param {RecordedAction|RecordedMove} action - recorded action.
   */
  record(action) {
    const { mesh, ...actionProps } = action
    if (this.isManaging(mesh)) {
      const notification = {
        ...actionProps,
        meshId: mesh.id,
        fromHand: this.handScene === mesh.getScene()
      }
      if ('fn' in actionProps) {
        this.onActionObservable.notifyObservers({
          ...notification,
          fromHand:
            actionProps.fn === actionNames.play ? false : notification.fromHand,
          isLocal:
            actionProps.isLocal ||
            this.localKeys.has(getKey({ meshId: mesh.id, ...actionProps }))
        })
      } else {
        this.onActionObservable.notifyObservers(notification)
      }
    }
  }

  /**
   * Invokes a mesh's function as if it was local (does not propagate to peer).
   * Used by cascading actions.
   * @param {?import('@babylonjs/core').Mesh} mesh - mesh on which the action is called.
   * @param {import('@tabulous/types').ActionName} fn - incoked function name.
   * @param  {...any} args - invokation arguments, if any.
   */
  async invokeLocal(mesh, fn, ...args) {
    if (!mesh || !this.isManaging(mesh)) {
      return
    }
    // inhibits to avoid looping when this mesh will invoke apply()
    const key = getKey({ meshId: mesh?.id, fn })
    this.localKeys.add(key)
    // @ts-expect-error -- args can not be narrowed
    await mesh?.metadata[fn]?.(...args)
    this.localKeys.delete(key)
  }

  /**
   * Reverts an action by calling a mesh's behavior revert() function.
   * Reverts a move by positioning it back to its previous position.
   * @param {Omit<import('@tabulous/types').Action, 'fromHand'>|Omit<import('@tabulous/types').Move, 'fromHand'>} actionOrMove - reverted action or move.
   */
  async revert(actionOrMove) {
    const mesh = this.controlables.get(actionOrMove.meshId)
    /* c8 ignore start */
    if (!mesh && 'fn' in actionOrMove && actionOrMove.fn !== actionNames.draw) {
      console.warn(
        { actionOrMove },
        `failed to revert action/move on mesh ${actionOrMove.meshId}: mesh not controlled.`
      )
    }
    /* c8 ignore stop */
    if ('fn' in actionOrMove) {
      const { fn, args } = actionOrMove
      if (fn === actionNames.draw) {
        await this.managers.hand.applyPlay(args[0], args[1])
      } else {
        for (const behavior of mesh?.behaviors ?? []) {
          if ('revert' in behavior) {
            await behavior.revert(fn, args)
          }
        }
      }
    } else if (mesh) {
      await animateMove(
        mesh,
        Vector3.FromArray(actionOrMove.prev),
        null,
        actionOrMove.duration ?? 0
      )
    }
  }

  /**
   * Applies an actions to a controlled meshes (`fn` in its metadatas), or changes its position (action.pos is defined).
   * Does nothing if the target mesh is not controlled.
   * Returns when the action is fully applied.
   * @param {Omit<import('@tabulous/types').Action, 'fromHand'>|Omit<import('@tabulous/types').Move, 'fromHand'>} action - applied action.
   */
  async apply(action) {
    const mesh = this.controlables.get(action?.meshId)
    const key = getKey(action)
    // inhibits to avoid looping when this mesh will invoke apply()
    this.localKeys.add(key)
    if ('fn' in action) {
      const args = action.args || []
      if (action.fn === actionNames.play) {
        await this.managers.hand.applyPlay(args[0], args[1])
      } else {
        // @ts-expect-error -- args can not be narrowed
        await mesh?.metadata?.[action.fn]?.(...args)
      }
    } else if (action.pos && mesh) {
      await animateMove(
        mesh,
        Vector3.FromArray(action.pos),
        null,
        action.duration ?? 0
      )
    }
    this.localKeys.delete(key)
  }
}

function getKey(
  /** @type {Partial<Pick<import('@tabulous/types').Action, 'meshId'|'fn'>>} */ action
) {
  return `${action?.meshId}-${action.fn?.toString() || 'pos'}`
}
