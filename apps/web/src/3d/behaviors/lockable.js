import { makeLogger } from '../../utils/logger'
import { controlManager } from '../managers/control'
import { indicatorManager } from '../managers/indicator'
import { actionNames } from '../utils/actions'
import { attachFunctions, attachProperty } from '../utils/behaviors'
import { LockBehaviorName, MoveBehaviorName } from './names'

const logger = makeLogger(LockBehaviorName)

/**
 * @typedef {object} LockableState behavior persistent state, including:
 * @property {boolean} [isLocked=false] - whether this mesh is locked or not.
 */

export class LockBehavior {
  /**
   * Creates behavior to lock some actions on a mesh, by acting on other behaviors.
   *
   * @property {import('@babylonjs/core').Mesh} mesh - the related mesh.
   * @property {LockableState} state - the behavior's current state.
   *
   * @param {LockableState} state - behavior state.
   */
  constructor(state = {}) {
    this.mesh = null
    this.state = { isLocked: state?.isLocked ?? false }
  }

  /**
   * @property {string} name - this behavior's constant name.
   */
  get name() {
    return LockBehaviorName
  }

  /**
   * Does nothing.
   * @see {@link import('@babylonjs/core').Behavior.init}
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
    const { mesh, state } = this
    if (!mesh) {
      return
    }
    controlManager.record({ mesh, fn: actionNames.toggleLock })
    indicatorManager.registerFeedback({
      action: state.isLocked ? 'unlock' : 'lock',
      position: mesh.absolutePosition.asArray()
    })
    state.isLocked = !state.isLocked
    for (const name of [MoveBehaviorName]) {
      setEnabled(mesh, name, !state.isLocked)
    }
  }

  /**
   * Updates this behavior's state and mesh to match provided data.
   * @param {LockableState} state - state to update to.
   */
  fromState({ isLocked = false } = {}) {
    if (!this.mesh) {
      throw new Error('Can not restore state without mesh')
    }
    this.state = { isLocked }
    setEnabled(this.mesh, MoveBehaviorName, !isLocked)
    attachFunctions(this, actionNames.toggleLock)
    attachProperty(this, 'isLocked', () => this.state.isLocked)
  }
}

function setEnabled(mesh, behaviorName, enabled) {
  const behavior = mesh.getBehaviorByName(behaviorName)
  if (
    behavior &&
    (!mesh.metadata?.stack ||
      mesh.metadata.stack[mesh.metadata.stack.length - 1] === mesh)
  ) {
    logger.debug(
      { mesh, behavior },
      `${enabled ? 'unlocks' : 'locks'} behavior ${behaviorName}`
    )
    behavior.enabled = enabled
  }
}
