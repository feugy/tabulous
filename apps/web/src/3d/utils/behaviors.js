// @ts-check
/**
 * @typedef {import('@babylonjs/core').AbstractMesh} AbstractMesh
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@tabulous/server/src/graphql').Dimension} Dimension
 * @typedef {import('@tabulous/server/src/graphql').Mesh} _SerializedMesh
 * @typedef {import('@src/3d/behaviors').AnimateBehavior} AnimateBehavior
 * @typedef {import('@src/3d/behaviors').TargetBehavior} TargetBehavior
 * @typedef {import('@src/3d/behaviors/names')} _BehaviorNames
 * @typedef {import('@src/3d/behaviors/randomizable').Extras} Extras
 * @typedef {import('@src/3d/managers/target').DropZone} DropZone
 */

import { Animation } from '@babylonjs/core/Animations/animation'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'

import { makeLogger } from '../../utils/logger'
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
import { setExtras } from './mesh'

/** @typedef {_BehaviorNames[keyof _BehaviorNames]} BehaviorNames */
/** @typedef {AnchorBehavior|DetailBehavior|DrawBehavior|FlipBehavior|LockBehavior|MoveBehavior|QuantityBehavior|RandomBehavior|RotateBehavior|StackBehavior} Behavior */
/** @typedef {Record<string, ?> & Pick<SerializedMesh, 'anchorable'|'detailable'|'movable'|'drawable'|'flippable'|'lockable'|'quantifiable'|'randomizable'|'rotable'|'stackable'>} BehaviorState */
/** @typedef {_SerializedMesh & { randomizable?: _SerializedMesh['randomizable'] & Partial<Extras> }} SerializedMesh */

const animationLogger = makeLogger('animatable')

/** @type {?[BehaviorNames, { new (state: ?, managers: import('@src/3d/managers').Managers): Behavior }][]} */
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
 * @param {Mesh} mesh - the modified mesh.
 * @param {BehaviorState} params - parameters, which may contain behavior specific states.
 * @param {import('@src/3d/managers').Managers} managers - current managers
 */
export function registerBehaviors(mesh, params, managers) {
  for (const [name, constructor] of getConstructors()) {
    if (params[name]) {
      mesh.addBehavior(new constructor(params[name], managers), true)
    }
  }
}

/**
 * Restores a mesh behaviors states from the provided paramerter object.
 * Warning! stackable behavior is ignored, since it needs all mesh to exist before being restored.
 * @param {Behavior[]} behaviors - list of serialized behaviors.
 * @param {BehaviorState} state hash of behavior states.
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
 * @param {Behavior[]} behaviors - list of serialized behaviors.
 * @returns an hash of behavior states.
 */
export function serializeBehaviors(behaviors) {
  /** @type {BehaviorState} */
  const result = {}
  for (const behavior of behaviors) {
    result[behavior.name] = behavior.state ? { ...behavior.state } : undefined
  }
  return result
}

/**
 * Moves, with an animation if possible, a mesh to a given position.
 * When requested, will apply gravity at the end.
 * @param {Mesh} mesh - the moved mesh.
 * @param {Vector3} absolutePosition - its final, absolute position.
 * @param {?Vector3} rotation - its final rotation (set to null to leave unmodified).
 * @param {number} [duration] - how long, in ms, the move will last.
 * @param {boolean} [withGravity=false] - whether to apply gravity at the end.
 */
export function animateMove(
  mesh,
  absolutePosition,
  rotation,
  duration,
  withGravity = false
) {
  const movable = getAnimatableBehavior(mesh)
  if (!mesh.getEngine().isLoading && movable && duration) {
    return movable.moveTo(
      absolutePosition,
      rotation,
      mesh.getEngine().isSimulation ? 0 : duration,
      withGravity
    )
  } else {
    mesh.setAbsolutePosition(absolutePosition)
    if (rotation != undefined) {
      mesh.rotation = rotation
    }
    if (withGravity) {
      applyGravity(mesh)
    }
  }
}

/**
 * Finds and returns an animatable behavior of a given mesh.
 * @param {Mesh} [mesh] - related mesh.
 * @returns {?MoveBehavior|FlipBehavior|DrawBehavior|RotateBehavior|RandomBehavior|AnimateBehavior|undefined} an Animatable behavior (or one of its subimplementation) if any.
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
 * @param {Mesh} [mesh] - related mesh.
 * @returns {?StackBehavior|AnchorBehavior|QuantityBehavior|TargetBehavior|undefined} a Target behavior (or one of its subimplementation) if any.
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
 * @param {Mesh} [mesh] - related mesh.
 * @returns whether the mesh is flipped.
 */
export function isMeshFlipped(mesh) {
  return mesh?.metadata?.isFlipped ?? false
}

/**
 * Indicates whether a mesh has been rotated twice (its angle is PI).
 * @param {Mesh} [mesh] - related mesh.
 * @returns whether the mesh is inverted.
 */
export function isMeshInverted(mesh) {
  return mesh?.metadata?.angle === Math.PI ?? false
}

/**
 * Indicates whether a mesh is locked (prevents moves and interactions)
 * @param {Mesh} [mesh] - related mesh.
 * @returns whether the mesh is locked.
 */
export function isMeshLocked(mesh) {
  return mesh?.metadata?.isLocked ?? false
}

/**
 * Returns absolute position of all part centers of a given mesh (after applying any transformations).
 * @param {Mesh} mesh - related mesh
 * @returns a list of absolute positions.
 */
export function getMeshAbsolutePartCenters(mesh) {
  if (!mesh.metadata?.partCenters?.length) {
    return [mesh.absolutePosition]
  }
  const matrix = mesh.computeWorldMatrix()
  const centers = []
  for (const { x, y, z } of mesh.metadata.partCenters) {
    centers.push(
      Vector3.TransformCoordinates(new Vector3(x ?? 0, y ?? 0, z ?? 0), matrix)
    )
  }
  return centers
}

/**
 * Attaches a read-only property to a given behavior's mesh metadata.
 * Behavior must be attached to a mesh.
 * @template T
 * @param {Behavior} behavior - related behavior.
 * @param {string} property - name of the created property.
 * @param {() => T} getter - getter function.
 */
export function attachProperty(behavior, property, getter) {
  if (!behavior.mesh) return
  if (!behavior.mesh.metadata) {
    behavior.mesh.metadata = /** @type {?} */ ({})
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
 * @template {Behavior} B
 * @param {B} behavior - related behavior.
 * @param {(keyof B)[]} functionNames - one or several behavior function names.
 */
export function attachFunctions(behavior, ...functionNames) {
  if (!behavior.mesh) return
  if (!behavior.mesh.metadata) {
    behavior.mesh.metadata = /** @type {?} */ ({})
  }
  const metadata = /** @type {?} */ (behavior.mesh.metadata)
  for (const functionName of functionNames) {
    metadata[functionName] = /** @type {function } */ (
      behavior[functionName]
    ).bind(behavior)
  }
}

/**
 * @typedef {object} AnimationSpec - an animation's specifications:
 * @property {Animation} animation - the animation object ran (controls one property of the animated mesh).
 * @property {(FloatKeyFrame|Vector3KeyFrame|QuaternionKeyFrame)[]} keys - a list of keys for the animation object, as allowed by Babylon's Animation.Parse() methode
 * @property {number} duration - duration in milliseconds.
 */

/**
 * Runs in parallel a list of animations for a given AnimateBehavior.
 * While running animations:
 * - the mesh's animationInProgress is true
 * - the mesh is not pickable
 *
 * When all animation have completed:
 * - onEnd function is synchronously invoked
 * - the mesh's onAnimationEnd observers are notified.
 *
 * The animation keys are serialized as per Babylon's Animation Curve Editor.
 * @param {AnimateBehavior} behavior - animated behavior.
 * @param {?() => void} onEnd - function invoked when all animations have completed.
 * @param {AnimationSpec[]} animationSpecs - list of animation specs.
 */
export function runAnimation({ mesh, frameRate }, onEnd, ...animationSpecs) {
  if (!mesh) {
    return Promise.resolve(void 0)
  }
  const lastFrame = buildLastFrame(frameRate, animationSpecs)
  /** @type {Animation[]} */
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
      keys
        .map(key =>
          // @ts-expect-error
          parse(key, lastFrame)
        )
        .sort((a, b) => a.frame - b.frame)
    )
  }
  // prevents interactions and collisions
  const wasPickable = mesh.isPickable
  mesh.isPickable = false
  const wasHittable = mesh.isHittable
  mesh.isHittable = false
  mesh.animationInProgress = true
  animationLogger.debug({ mesh, animations }, `starts animations on ${mesh.id}`)
  return new Promise(resolve =>
    mesh
      .getScene()
      .beginDirectAnimation(
        mesh,
        animations,
        0,
        lastFrame,
        false,
        mesh.getEngine().isSimulation ? 100 : 1,
        () => {
          animationLogger.debug(
            { mesh, animations, wasPickable, wasHittable },
            `end animations on ${mesh.id}`
          )
          mesh.isPickable = wasPickable
          mesh.isHittable = wasHittable
          mesh.animationInProgress = false
          // framed animation may not exactly end where we want, so force the final position
          for (const { animation } of animationSpecs) {
            // @ts-expect-error can not use animation.targetProperty to index Mesh
            mesh[animation.targetProperty] =
              animation.getKeys()[animation.getKeys().length - 1].value
          }
          mesh.computeWorldMatrix(true)
          if (onEnd) {
            onEnd()
          }
          resolve(void 0)
          mesh.onAnimationEnd.notifyObservers()
        }
      )
  )
}

/**
 * Because Babylon can not animate absolute position but only relative position,
 * one needs to temporary detach an animated mesh from its parent, or rotation may alter the movements.
 * This function detaches a given mesh, keeping its absolute position and rotation unchanged, then
 * returns a function to re-attach to the original parent (or new, if it has changed meanwhile).
 * @template {AbstractMesh} M
 * @param {M} mesh - detached mesh.
 * @param {boolean} [detachChildren=true] - set to detach the mesh from its children.
 * @returns a function to re-attach to the original (or new) parent.
 */
export function detachFromParent(mesh, detachChildren = true) {
  let parent = /** @type {?M} */ (mesh.parent)
  mesh.setParent(null)
  parent?.detachedChildren.push(mesh)

  const savedSetter = mesh.setParent.bind(mesh)
  mesh.setParent = (/** @type {?M} */ newParent) => {
    parent = newParent
    return mesh
  }

  mesh.detachedChildren = detachChildren
    ? mesh.getChildMeshes(true, child => !(/** @type {M} */ (child).isDropZone))
    : []
  for (const child of mesh.detachedChildren) {
    child.setParent(null)
  }

  return () => {
    mesh.setParent = savedSetter
    mesh.setParent(parent)
    parent?.detachedChildren.splice(parent.detachedChildren.indexOf(mesh), 1)
    for (const child of mesh.detachedChildren) {
      child.setParent(mesh)
    }
    mesh.detachedChildren = []
  }
}

/**
 * Computes the final position of a given above a drop zone
 * @param {Mesh} droppedMesh - mesh dropped above zone.
 * @param {DropZone} zone - drop zone.
 * @returns absolute position for this mesh.
 */
export function getPositionAboveZone(droppedMesh, zone) {
  zone.mesh.computeWorldMatrix(true)
  const { x, z } = zone.mesh.getAbsolutePosition()
  return new Vector3(
    x,
    getCenterAltitudeAbove(
      /** @type {Mesh} */ (zone.targetable.mesh),
      droppedMesh
    ),
    z
  )
}

function buildLastFrame(
  /** @type {number} */ frameRate,
  /** @type {AnimationSpec[]} */ animationSpecs
) {
  let maxDuration = 0
  for (const { duration } of animationSpecs) {
    maxDuration = Math.max(duration, maxDuration)
  }
  return Math.round(frameRate * (maxDuration / 1050))
}

// inspired from Animation.Parse() https://github.com/BabylonJS/Babylon.js/blob/fab7d3b3e16cb8bda0a16b3d2d9b825c953d3488/packages/dev/core/src/Animations/animation.ts#L1316

/**
 * @template {Array<number>} T
 * @typedef {object} KeyFrame
 * @property {number} frame
 * @property {[...T, ?T|undefined, ?T|undefined]} values
 */
/** @typedef {KeyFrame<[number, number, number]>} Vector3KeyFrame */
/** @typedef {KeyFrame<[number, number, number, number]>} QuaternionKeyFrame */

/**
 * @typedef {object} FloatKeyFrame
 * @property {number} frame
 * @property {[number, ?number|undefined, ?number|undefined]} values
 */

/**
 * @param {Vector3KeyFrame} data
 * @param {number} lastFrame
 * @returns {import('@babylonjs/core').IAnimationKey}
 */
function parseVector3(
  { frame, values: [x, y, z, inTangent, outTangent] },
  lastFrame
) {
  return {
    frame: (frame * lastFrame) / 100,
    value: Vector3.FromArray([x, y, z]),
    inTangent: inTangent ? Vector3.FromArray(inTangent) : undefined,
    outTangent: outTangent ? Vector3.FromArray(outTangent) : undefined
  }
}

/**
 * @param {QuaternionKeyFrame} data
 * @param {number} lastFrame
 * @returns {import('@babylonjs/core').IAnimationKey}
 */
function parseQuaternion(
  { frame, values: [x, y, z, w, inTangent, outTangent] },
  lastFrame
) {
  return {
    frame: (frame * lastFrame) / 100,
    value: Quaternion.FromArray([x, y, z, w]),
    inTangent: inTangent ? Quaternion.FromArray(inTangent) : undefined,
    outTangent: outTangent ? Quaternion.FromArray(outTangent) : undefined
  }
}

/**
 * @param {FloatKeyFrame} data
 * @param {number} lastFrame
 * @returns {import('@babylonjs/core').IAnimationKey}
 */
function parseFloat(
  { frame, values: [value, inTangent, outTangent] },
  lastFrame
) {
  return {
    frame: (frame * lastFrame) / 100,
    value,
    inTangent,
    outTangent
  }
}

/**
 * Builds a "target" mesh that can be used as a targetable zone.
 * It'll be assigned as a child or the provided parent.
 * Creates a cylinder for cylindric meshes or when providing dimension's diameter.
 * Otherwise, creates a box.
 * @param {string} name - new mesh's name
 * @param {Mesh} parent - mesh to copy dimensions and shape from.
 * @param {Dimension} [dimensions] - target dimensions. When specified, prevail on parent's shape:
 * @returns created target mesh.
 */
export function buildTargetMesh(name, parent, dimensions) {
  parent.computeWorldMatrix(true)
  const { x, y, z } = parent.getBoundingInfo().boundingBox.extendSizeWorld
  const scene = parent.getScene()
  const isCylindric =
    'diameter' in (dimensions ?? {}) ||
    (parent.isCylindric && !dimensions?.width)
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
  setExtras(created, { isCylindric, isHittable: false })
  created.isCylindric = isCylindric
  created.setParent(parent)
  created.position = Vector3.Zero()
  return created
}

/**
 * Returns the current face image of a Detailable mesh.
 * @param {Mesh} mesh - concerned mesh.
 * @returns the mesh back image if it is flipped, or its front image. Defaults to null.
 */
export function selectDetailedFace(mesh) {
  return (
    (Boolean(mesh.metadata?.detail) &&
      (isMeshFlipped(mesh)
        ? mesh.metadata.backImage
        : mesh.metadata.frontImage)) ||
    null
  )
}
