// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@tabulous/server/src/graphql/types').ZoomSpec} ZoomSpec
 * @typedef {import('@src/3d/managers/camera').CameraPosition} CameraPosition
 * @typedef {import('@src/3d/utils').ScreenPosition} ScreenPosition
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { Observable } from '@babylonjs/core/Misc/observable.js'

import { actionNames } from '../utils/actions'

/**
 * @typedef {object} _Action
 * @property {string} meshId - modified mesh id.
 * @property {boolean} fromHand - indicates whether this action comes from hand or main scene.
 *
 * @typedef {Omit<RecordedAction, 'mesh'> & _Action & { pos: undefined }} Action applied action to a given mesh.
 *
 * @typedef {object} _Move applied move to a given mesh:
 * @property {string} meshId - modified mesh id.
 * @property {boolean} fromHand - indicates whether this action comes from hand or main scene.
 *
 * @typedef {Omit<RecordedMove, 'mesh'> & _Move & { fn: undefined, args: undefined }} Move applied move to a given mesh.
 *
 * @typedef {object} RecordedAction applied action to a given mesh:
 * @property {Mesh} mesh - modified mesh.
 * @property {string} fn - name of the applied action.
 * @property {any[]} args - argument array for this action.
 * @property {number} [duration] - optional animation duration, in milliseconds.
 *
 * @typedef {object} RecordedMove applied action to a given mesh:
 * @property {Mesh} mesh - modified mesh.
 * @property {number[]} pos - absolute position.
 * @property {number} [duration] - optional animation duration, in milliseconds.
 *
 * @typedef {object} MeshDetails details of a given mesh.
 * @property {Mesh} mesh - the detailed mesh.
 * @property {object} data - detailed data, including:
 * @property {string} data.image? - image for that mesh.
 */

class ControlManager {
  /**
   * Creates a manager to remotely control a collection of meshes:
   * - applies actions received to specific meshes
   * - propagates applied actions to observers (with cycle breaker)
   * Clears all observers on scene disposal.
   */
  constructor() {
    /** @type {Observable<Action|Move>} emits applied actions. */
    this.onActionObservable = new Observable()
    /** @type {Observable<MeshDetails>} emits when displaying details of a given mesh. */
    this.onDetailedObservable = new Observable()
    /** @type {Observable<Map<String, Mesh>>} emits the list of controlled meshes. */
    this.onControlledObservable = new Observable()

    /** @private @type {?Scene} */
    this.scene = null
    /** @private @type {?Scene} */
    this.handScene = null
    /** @private @type {Map<string, Mesh>} */
    this.controlables = new Map()
    // prevents loops when applying an received action
    /** @private @type {Set<string>} */
    this.inhibitedKeys = new Set()
  }

  /**
   * Gives a scene to the manager.
   * @param {object} params - parameters, including:
   * @param {Scene} params.scene - main scene.
   * @param {Scene} params.handScene - scene for meshes in hand.
   */
  init({ scene, handScene }) {
    this.scene = scene
    this.handScene = handScene
    this.scene.onDisposeObservable.addOnce(() => {
      this.onActionObservable.clear()
      this.onDetailedObservable.clear()
      this.onControlledObservable.clear()
    })
  }

  /**
   * Registers a new controllable mesh.
   * Does nothing if this mesh is already managed.
   * @param {Mesh} mesh - controled mesh (needs at least an id property).
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
   * @param {Mesh} mesh - controlled mesh (needs at least an id property).
   */
  unregisterControlable(mesh) {
    if (this.controlables.delete(mesh?.id)) {
      this.onControlledObservable.notifyObservers(this.controlables)
    }
  }

  /**
   * @param {Mesh} mesh - tested mesh
   * @returns {boolean} whether this mesh is controlled or not
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
    if (
      !this.inhibitedKeys.has(getKey({ meshId: mesh?.id, ...actionProps })) &&
      this.isManaging(mesh)
    ) {
      this.onActionObservable.notifyObservers({
        pos: undefined,
        fn: undefined,
        args: undefined,
        ...actionProps,
        meshId: mesh.id,
        fromHand:
          this.handScene === mesh.getScene() &&
          /** @type {RecordedAction} */ (actionProps).fn !== actionNames.draw
      })
      this.onControlledObservable.notifyObservers(this.controlables)
    }
  }

  /**
   * Applies an actions to a controlled meshes (`fn` in its metadatas), or changes its position (action.pos is defined).
   * Does nothing if the target mesh is not controlled.
   * Returns when the action is fully applied.
   * @param {Action|Move} action - applied action.
   * @param {boolean} fromPeer - true to indicate this action comes from a remote peer.
   * @returns {Promise<void>}
   */
  async apply(action, fromPeer = false) {
    const mesh = this.controlables.get(action?.meshId)
    if (!mesh) return

    const key = getKey(action)
    // inhibits to avoid looping when this mesh will invoke apply()
    if (fromPeer) {
      this.inhibitedKeys.add(key)
    }
    if (action.fn) {
      await mesh.metadata?.[action.fn]?.(...(action.args || []))
    } else if (action.pos) {
      mesh.setAbsolutePosition(Vector3.FromArray(action.pos))
    }
    this.onControlledObservable.notifyObservers(this.controlables)
    this.inhibitedKeys.delete(key)
  }
}

/**
 * Control manager singleton.
 * @type {ControlManager}
 */
export const controlManager = new ControlManager()

/**
 * @param {Partial<Pick<Action, 'meshId'|'fn'>>} action - keyed action
 * @returns {string} key for this action
 */
function getKey(action) {
  return `${action?.meshId}-${action.fn?.toString() || 'pos'}`
}
