// @ts-check
import { makeLogger } from '../../utils/logger'
import { actionNames } from '../utils/actions'
import { attachFunctions, attachProperty } from '../utils/behaviors'
import { MoveBehavior } from './movable'
import { LockBehaviorName, MoveBehaviorName } from './names'

/** @typedef {import('@tabulous/types').LockableState & Required<Pick<import('@tabulous/types').LockableState, 'isLocked'>>} RequiredLockableState */

const logger = makeLogger(LockBehaviorName)

export class LockBehavior {
  /**
   * Creates behavior to lock some actions on a mesh, by acting on other behaviors.
   * @param {import('@tabulous/types').LockableState} state - behavior state.
   * @param {import('../managers').Managers} managers - current managers.
   */
  constructor(state, managers) {
    /** @internal */
    this.managers = managers
    /** @type {?import('@babylonjs/core').Mesh} mesh - the related mesh. */
    this.mesh = null
    /**  the behavior's current state. */
    this.state = { isLocked: state?.isLocked ?? false }
  }

  get name() {
    return LockBehaviorName
  }

  /**
   * Does nothing.
   * @see https://doc.babylonjs.com/typedoc/interfaces/babylon.behavior#init
   */
  init() {}

  /**
   * Attaches this behavior to a mesh, adding to its metadata:
   * - `isLocked` property.
   * - the `toggleLock()` method.
   * It also enables or disables companion behaviors based on desired state.
   * @param {import('@babylonjs/core').Mesh} mesh - which becomes detailable.
   */
  attach(mesh) {
    this.mesh = mesh
    this.fromState(this.state)
  }

  /**
   * Detaches this behavior from its mesh.
   */
  detach() {
    this.mesh = null
  }

  /**
   * If attached, disable, or enable, some of the mesh's other behaviors.
   */
  toggleLock() {
    const { mesh } = this
    if (!mesh) {
      return
    }
    internalToggle(this)
  }

  /**
   * Revert flip actions. Ignores other actions
   * @param {import('@tabulous/types').ActionName} action - reverted action.
   */
  async revert(action) {
    if (action === actionNames.toggleLock && this.mesh) {
      internalToggle(this, true)
    }
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {import('@tabulous/types').LockableState} state - state to update to.
   */
  fromState({ isLocked = false } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this.state = { isLocked }
    setEnabled(this.mesh, !isLocked)
    attachFunctions(this, 'toggleLock')
    attachProperty(this, 'isLocked', () => this.state.isLocked)
  }
}

function internalToggle(
  /** @type {LockBehavior} */ { state, mesh, managers },
  isLocal = false
) {
  if (mesh) {
    managers.control.record({
      mesh,
      fn: actionNames.toggleLock,
      args: [],
      isLocal
    })
    managers.indicator.registerFeedback({
      action: state.isLocked ? 'unlock' : 'lock',
      position: mesh.absolutePosition.asArray()
    })
    state.isLocked = !state.isLocked
    setEnabled(mesh, !state.isLocked)
  }
}

function setEnabled(
  /** @type {import('@babylonjs/core').Mesh} */ mesh,
  /** @type {boolean} */ enabled
) {
  const behavior = mesh.getBehaviorByName(MoveBehaviorName)
  if (
    behavior &&
    (!mesh.metadata?.stack ||
      mesh.metadata.stack[mesh.metadata.stack.length - 1] === mesh)
  ) {
    logger.debug(
      { mesh, behavior },
      `${enabled ? 'unlocks' : 'locks'} behavior ${MoveBehavior.name}`
    )
    behavior.enabled = enabled
  }
}
