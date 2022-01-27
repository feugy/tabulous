import {
  AnchorBehavior,
  DetailBehavior,
  FlipBehavior,
  MoveBehavior,
  RotateBehavior,
  StackBehavior
} from '../behaviors'
import {
  AnchorBehaviorName,
  AnimateBehaviorName,
  DetailBehaviorName,
  FlipBehaviorName,
  MoveBehaviorName,
  RotateBehaviorName,
  StackBehaviorName,
  TargetBehaviorName
} from '../behaviors/names'
import { applyGravity } from './gravity'

const behaviorNames = [
  [MoveBehaviorName, MoveBehavior],
  [FlipBehaviorName, FlipBehavior],
  [RotateBehaviorName, RotateBehavior],
  [DetailBehaviorName, DetailBehavior],
  [AnchorBehaviorName, AnchorBehavior],
  [StackBehaviorName, StackBehavior]
]

/**
 * Looks into the given parameters, and creates relevant behaviors according to its content.
 * It uses behavior names to identify the desired behaviore.
 * For example, when given parameters contain 'anchorable' object, it creates an AnchorBehavior
 * and attach it to the mesh.
 * @param {import('@babel/core').Mesh} mesh - the modified mesh.
 * @param {object} params - parameters, which may contain behavior specific states.
 * @returns {object} an hash of registered behaviors, by their names.
 */
export function registerBehaviors(mesh, params) {
  const registered = {}
  for (const [name, constructor] of behaviorNames) {
    if (params[name]) {
      registered[name] = new constructor(params[name])
      mesh.addBehavior(registered[name], true)
    }
  }
  return registered
}

/**
 * Restores a mesh behaviors states from the provided paramerter object.
 * Warning! stackable behavior is ignored, since it needs all mesh to exist before being restored.
 * @param {import('@babel/core').Behavior[]} behaviors - list of serialized behaviors.
 * @param {object} state hash of behavior states.
 */
export function restoreBehaviors(behaviors, state) {
  for (const behavior of behaviors) {
    if (state[behavior.name] && behavior.name !== StackBehaviorName) {
      behavior.fromState?.(state[behavior.name])
    }
  }
}

/**
 * Creates an hash which keys are behavior names, and values their respective states, when relevant.
 * @param {import('@babel/core').Behavior[]} behaviors - list of serialized behaviors.
 * @returns {object} an hash of behavior states.
 */
export function serializeBehaviors(behaviors) {
  const result = {}
  for (const behavior of behaviors) {
    if (behavior.state) {
      result[behavior.name] = behavior.state
    }
  }
  return result
}

/**
 * Moves, with an animation if possible, a mesh to a given position.
 * When requested, will apply gravity at the end.
 * @async
 * @param {import('@babel/core').Mesh} mesh - the moved mesh.
 * @param {import('@babel/core').Vector3} absolutePosition - its final, absolute position.
 * @param {number} duration - how long, in ms, the move will last.
 * @param {boolean} [withGravity=false] - whether to apply gravity at the end.
 */
export async function animateMove(
  mesh,
  absolutePosition,
  duration,
  withGravity = false
) {
  const movable = getAnimatableBehavior(mesh)
  if (mesh.getScene().isLoading || !movable || !duration) {
    mesh.setAbsolutePosition(absolutePosition)
    if (withGravity) {
      applyGravity(mesh)
    }
  } else {
    await movable.moveTo(absolutePosition, duration, withGravity)
  }
}

/**
 * Finds and returns an animatable behavior of a given mesh.
 * @param {import('@babel/core').Mesh} mesh - related mesh.
 * @returns an Animatable behavior (or one of its subimplementation) if any.
 */
export function getAnimatableBehavior(mesh) {
  return (
    mesh?.getBehaviorByName(AnimateBehaviorName) ??
    mesh?.getBehaviorByName(FlipBehaviorName) ??
    mesh?.getBehaviorByName(RotateBehaviorName)
  )
}

/**
 * Finds and returns a targetable behavior of a given mesh.
 * @param {import('@babel/core').Mesh} mesh - related mesh.
 * @returns a Target behavior (or one of its subimplementation) if any.
 */
export function getTargetableBehavior(mesh) {
  return (
    mesh?.getBehaviorByName(StackBehaviorName) ??
    mesh?.getBehaviorByName(AnchorBehaviorName) ??
    mesh?.getBehaviorByName(TargetBehaviorName)
  )
}
