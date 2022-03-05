import { Animation } from '@babylonjs/core/Animations/animation'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import {
  AnchorBehavior,
  DetailBehavior,
  DrawBehavior,
  FlipBehavior,
  MoveBehavior,
  RotateBehavior,
  StackBehavior
} from '../behaviors'
import {
  AnchorBehaviorName,
  AnimateBehaviorName,
  DetailBehaviorName,
  DrawBehaviorName,
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
  [DrawBehaviorName, DrawBehavior],
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
    result[behavior.name] = behavior.state
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

/**
 * Indicates whether a mesh is flipped or not.
 * @param {import('@babel/core').Mesh} mesh - related mesh.
 * @returns a boolean indicating whether the mesh is flipped.
 */
export function isMeshFlipped(mesh) {
  return mesh?.metadata?.isFlipped ?? false
}

/**
 * Indicates whether a mesh has been rotated twice (its angle is PI).
 * @param {import('@babel/core').Mesh} mesh - related mesh.
 * @returns a boolean indicating whether the mesh is inverted.
 */
export function isMeshInverted(mesh) {
  return mesh?.metadata?.angle === Math.PI ?? false
}

/**
 * Attaches a read-only property to a given behavior's mesh metadata.
 * Behavior must be attached to a mesh.
 * @param {import('@babel/core').Behavior} behavior - related behavior.
 * @param {string} property - name of the created property.
 * @param {function} getter - getter function.
 */
export function attachProperty(behavior, property, getter) {
  if (!behavior.mesh.metadata) {
    behavior.mesh.metadata = {}
  }
  Object.defineProperty(behavior.mesh.metadata, property, {
    get: getter,
    configurable: true,
    enumerable: true
  })
}

/**
 * Attaches a behavior function to its mesh's metadata.
 * Behavior must be attached to a mesh.
 * @param {import('@babel/core').Behavior} behavior - related behavior.
 * @param {string[]} functionNames - one or several behavior function names.
 */
export function attachFunctions(behavior, ...functionNames) {
  if (!behavior.mesh.metadata) {
    behavior.mesh.metadata = {}
  }
  for (const functionName of functionNames) {
    behavior.mesh.metadata[functionName] = behavior[functionName].bind(behavior)
  }
}

/**
 * @typedef {object} AnimationSpec - an animation's specifications:
 * @property {import('@babel/core').Animation} animation - the animation object ran (controls one property of the animated mesh).
 * @property {object[]} keys - a list of keys for the animation object, as allowed by Babylon's Animation.Parse() methode
 * @property {number} duration - duration in milliseconds.
 */

/**
 * Runs in parallel a list of animations for a given AnimateBehavior.
 * While running animations:
 * - the behavior's isAnimated is true
 * - the behavior's mesh is not pickable
 *
 * When all animation have completed:
 * - onEnd function is synchronously invoked
 * - the behavior's onAnimationEndObservable observers are notified.
 *
 * The animation keys are serialized as per Babylon's Animation Curve Editor.
 * @async
 * @param {import('../behaviors').AnimateBehavior} behavior - animated behavior.
 * @param {function} onEnd - function invoked when all animations have completed.
 * @param {AnimationSpec[]} animationSpecs - list of animation specs.
 */
export function runAnimation(behavior, onEnd, ...animationSpecs) {
  const { mesh, frameRate, onAnimationEndObservable } = behavior
  const lastFrame = buildLastFrame(frameRate, animationSpecs)
  const animations = []
  for (const { animation, keys } of animationSpecs) {
    animations.push(animation)
    const parse =
      animation.dataType === Animation.ANIMATIONTYPE_VECTOR3
        ? parseVector3
        : parseFloat
    animation.setKeys(
      keys.map(key => parse(key, lastFrame)).sort((a, b) => a.frame - b.frame)
    )
  }
  // prevents interactions and collisions
  mesh.isPickable = false
  behavior.isAnimated = true
  return new Promise(resolve =>
    mesh
      .getScene()
      .beginDirectAnimation(mesh, animations, 0, lastFrame, false, 1, () => {
        mesh.isPickable = true
        behavior.isAnimated = false
        // framed animation may not exactly end where we want, so force the final position
        for (const { animation } of animationSpecs) {
          mesh[animation.targetProperty] =
            animation.getKeys()[animation.getKeys().length - 1].value
        }
        mesh.computeWorldMatrix(true)
        if (onEnd) {
          onEnd()
        }
        onAnimationEndObservable.notifyObservers()
        resolve()
      })
  )
}

function buildLastFrame(frameRate, animationSpecs) {
  let maxDuration = 0
  for (const { duration } of animationSpecs) {
    maxDuration = Math.max(duration, maxDuration)
  }
  return Math.round(frameRate * (maxDuration / 1050))
}

// inspired from Animation.parse() https://github.com/BabylonJS/Babylon.js/blob/master/src/Animations/animation.ts#L1224

function parseVector3(
  { frame, values: [x, y, z, inTangent, outTangent, interpolation] },
  lastFrame
) {
  return {
    frame: (frame * lastFrame) / 100,
    value: Vector3.FromArray([x, y, z]),
    inTangent: inTangent ? Vector3.FromArray(inTangent) : undefined,
    outTangent: outTangent ? Vector3.FromArray(outTangent) : undefined,
    interpolation: interpolation ? Vector3.FromArray(interpolation) : undefined
  }
}

function parseFloat(
  { frame, values: [value, inTangent, outTangent, interpolation] },
  lastFrame
) {
  return {
    frame: (frame * lastFrame) / 100,
    value,
    inTangent,
    outTangent,
    interpolation
  }
}
