import { Animation } from '@babylonjs/core/Animations/animation.js'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js'

import { AnchorBehavior } from '../behaviors/anchorable'
import { DetailBehavior } from '../behaviors/detailable'
import { DrawBehavior } from '../behaviors/drawable'
import { FlipBehavior } from '../behaviors/flippable'
import { LockBehavior } from '../behaviors/lockable'
import { MoveBehavior } from '../behaviors/movable'
import {
  AnchorBehaviorName,
  AnimateBehaviorName,
  DetailBehaviorName,
  DrawBehaviorName,
  FlipBehaviorName,
  LockBehaviorName,
  MoveBehaviorName,
  QuantityBehaviorName,
  RandomBehaviorName,
  RotateBehaviorName,
  StackBehaviorName,
  TargetBehaviorName
} from '../behaviors/names'
import { QuantityBehavior } from '../behaviors/quantifiable'
import { RandomBehavior } from '../behaviors/randomizable'
import { RotateBehavior } from '../behaviors/rotable'
import { StackBehavior } from '../behaviors/stackable'
import { applyGravity, getCenterAltitudeAbove } from './gravity'

let constructors = null

function getConstructors() {
  if (constructors === null) {
    constructors = [
      [MoveBehaviorName, MoveBehavior],
      [FlipBehaviorName, FlipBehavior],
      [RotateBehaviorName, RotateBehavior],
      [DetailBehaviorName, DetailBehavior],
      [DrawBehaviorName, DrawBehavior],
      [AnchorBehaviorName, AnchorBehavior],
      [RandomBehaviorName, RandomBehavior],
      [StackBehaviorName, StackBehavior],
      [QuantityBehaviorName, QuantityBehavior],
      // always applies lockable at the end so it can alter other behaviors
      [LockBehaviorName, LockBehavior]
    ]
  }
  return constructors
}

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
  for (const [name, constructor] of getConstructors()) {
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
    result[behavior.name] = behavior.state ? { ...behavior.state } : undefined
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
  if (mesh.getEngine().isLoading || !movable || !duration) {
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
    mesh?.getBehaviorByName(MoveBehaviorName) ??
    mesh?.getBehaviorByName(FlipBehaviorName) ??
    mesh?.getBehaviorByName(DrawBehaviorName) ??
    mesh?.getBehaviorByName(RotateBehaviorName) ??
    mesh?.getBehaviorByName(RandomBehaviorName) ??
    mesh?.getBehaviorByName(AnimateBehaviorName)
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
    mesh?.getBehaviorByName(QuantityBehaviorName) ??
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
        : animation.dataType === Animation.ANIMATIONTYPE_QUATERNION
        ? parseQuaternion
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
        resolve()
        onAnimationEndObservable.notifyObservers()
      })
  )
}

/**
 * Because Babylon can not animate absolute position but only relative position,
 * one needs to temporary detach an animated mesh from its parent, or rotation may alter the movements.
 * This function detaches a given mesh, keeping its absolute position and rotation unchanged, then
 * returns a function to re-attach to the original parent (or new, if it has changed meanwhile).
 * @param {import('@babel/core').Mesh} mesh - detached mesh.
 * @returns {function} a function to re-attach to the original (or new) parent.
 */
export function detachFromParent(mesh) {
  let parent = mesh.parent
  mesh.setParent(null)

  const savedSetter = mesh.setParent.bind(mesh)
  mesh.setParent = newParent => {
    parent = newParent
  }

  const children = mesh.getChildMeshes(
    true,
    ({ name }) => !name.startsWith('drop-') && !name.startsWith('anchor-')
  )
  for (const child of children) {
    child.setParent(null)
  }

  return () => {
    mesh.setParent = savedSetter
    mesh.setParent(parent)
    for (const child of children) {
      child.setParent(mesh)
    }
  }
}

/**
 * Computes the final position of a given above a drop zone
 * @param {import('@babel/core').Mesh} droppedMesh - mesh dropped above zone.
 * @param {import('../behaviors').DropZone} zone - drop zone.
 * @returns {Vector3} absolute position for this mesh.
 */
export function getPositionAboveZone(droppedMesh, zone) {
  zone.mesh.computeWorldMatrix(true)
  const { x, z } = zone.mesh.getAbsolutePosition()
  return new Vector3(
    x,
    getCenterAltitudeAbove(zone.targetable.mesh, droppedMesh),
    z
  )
}

function buildLastFrame(frameRate, animationSpecs) {
  let maxDuration = 0
  for (const { duration } of animationSpecs) {
    maxDuration = Math.max(duration, maxDuration)
  }
  return Math.round(frameRate * (maxDuration / 1050))
}

// inspired from Animation.Parse() https://github.com/BabylonJS/Babylon.js/blob/d105658037e04471898a12232e5605c9b800c3dd/packages/dev/core/src/Animations/animation.ts#L1304

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

function parseQuaternion(
  { frame, values: [x, y, z, w, inTangent, outTangent, interpolation] },
  lastFrame
) {
  return {
    frame: (frame * lastFrame) / 100,
    value: Quaternion.FromArray([x, y, z, w]),
    inTangent: inTangent ? Quaternion.FromArray(inTangent) : undefined,
    outTangent: outTangent ? Quaternion.FromArray(outTangent) : undefined,
    interpolation: interpolation
      ? Quaternion.FromArray(interpolation)
      : undefined
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

/**
 * Builds a "target" mesh that can be used as a targetable zone.
 * It'll be assigned as a child or the provided parent.
 * Creates a cylinder for cylindric meshes or when providing dimension's diameter.
 * Otherwise, creates a box.
 * @param {string} name - new mesh's name
 * @param {import('@babel/core').Mesh} parent - mesh to copy dimensions and shape from.
 * @param {object} dimensions? - target dimensions. When specified, prevail on parent's shape:
 * @param {number} dimensions.width - target's width.
 * @param {number} dimensions.height - target's height.
 * @param {number} dimensions.depth - target's depth.
 * @param {number} dimensions.diameter - target's diameter.
 * @returns {import('@babel/core').Mesh} created target mesh.
 */
export function buildTargetMesh(name, parent, dimensions) {
  parent.computeWorldMatrix(true)
  const { x, y, z } = parent.getBoundingInfo().boundingBox.extendSizeWorld
  const scene = parent.getScene()
  const isCylindric =
    dimensions?.diameter || (parent.isCylindric && !dimensions?.width)
  const created = isCylindric
    ? CreateCylinder(
        name,
        dimensions ?? { diameter: x * 2, height: y * 2 },
        scene
      )
    : CreateBox(
        name,
        dimensions ?? { width: x * 2, height: y * 2, depth: z * 2 },
        scene
      )
  created.isCylindric = isCylindric
  created.parent = parent
  return created
}
