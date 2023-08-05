// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@tabulous/server/src/graphql').AnchorableState} AnchorableState
 * @typedef {import('@tabulous/server/src/graphql').Mesh} SerializedMesh
 * @typedef {import('@tabulous/server/src/graphql').Shape} Shape
 * @typedef {import('@tabulous/server/src/graphql').StackableState} StackableState
 * @typedef {import('@src/3d/behaviors/anchorable').AnchorBehavior} AnchorBehavior
 * @typedef {import('@src/3d/behaviors/stackable').StackBehavior} StackBehavior
 */

// mandatory side effect
import '@babylonjs/core/Loading/loadingScreen.js'

import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import clone from 'rfdc/default'

import { makeLogger } from '../../utils/logger'
import { AnchorBehaviorName, StackBehaviorName } from '../behaviors/names'
import { createBox } from '../meshes/box'
import { createCard } from '../meshes/card'
import { createCustom } from '../meshes/custom'
import { createDie } from '../meshes/die'
import { createPrism } from '../meshes/prism'
import { createRoundToken } from '../meshes/round-token'
import { createRoundedTile } from '../meshes/rounded-tile'
import { restoreBehaviors } from './behaviors'

/** @typedef {(state: Omit<SerializedMesh, 'shape'>, scene: Scene) => Mesh|Promise<Mesh>} MeshCreator */

const logger = makeLogger('scene-loader')

/** @type {Map<Shape, MeshCreator>} */
const meshCreatorByName = new Map([
  ['box', /** @type {?} */ (createBox)],
  ['card', /** @type {?} */ (createCard)],
  ['custom', /** @type {?} */ (createCustom)],
  ['die', /** @type {?} */ (createDie)],
  ['prism', /** @type {?} */ (createPrism)],
  ['roundToken', /** @type {?} */ (createRoundToken)],
  ['roundedTile', /** @type {?} */ (createRoundedTile)]
])

const supportedNames = new Set([...meshCreatorByName.keys()])

/**
 * Indicates whether a mesh can be serialized and loaded
 * @param {Mesh} mesh - tested mesh.
 * @returns {boolean} whether this mesh could be serialized and loaded.
 */
export function isSerializable(mesh) {
  return supportedNames.has(/** @type {Shape} */ (mesh.name))
}

/**
 * Serializes a scene's meshes.
 * @param {Scene} [scene] - 3D scene serialized.
 * @returns {SerializedMesh[]} list of serialized meshes.
 */
export function serializeMeshes(scene) {
  /** @type {SerializedMesh[]} */
  const meshes = []
  for (const mesh of scene?.meshes ?? []) {
    if (isSerializable(mesh) && !mesh.isPhantom) {
      meshes.push(mesh.metadata.serialize())
    }
  }
  logger.debug({ meshes }, `serialize meshes`)
  return meshes
}

/**
 * Creates a meshes into the provided scene.
 * @param {SerializedMesh} state - serialized mesh state.
 * @param {Scene} scene - 3D scene used.
 * @returns {Promise<Mesh>} mesh created.
 */
export async function createMeshFromState(state, scene) {
  const { shape } = state
  logger.debug({ state }, `create new ${shape} ${state.id}`)
  if (!supportedNames.has(shape)) {
    throw new Error(`mesh shape ${shape} is not supported`)
  }
  return /** @type {MeshCreator} */ (meshCreatorByName.get(shape))(state, scene)
}

/**
 * Loads meshes into the provided scene:
 * - either creates new mesh, or updates existing ones, based on their ids
 * - deletes existing mesh that are not found in the provided data
 * @param {Scene} scene - 3D scene used.
 * @param {SerializedMesh[]} meshes - a list of serialized meshes data.
 */
export async function loadMeshes(scene, meshes) {
  const disposables = new Set(scene.meshes)
  for (const mesh of disposables) {
    if (!isSerializable(mesh)) {
      disposables.delete(mesh)
    }
  }

  /** @type {{stackBehavior: StackBehavior, stackable: StackableState, y: number}[]} */
  const stackables = []
  /** @type {{anchorBehavior: AnchorBehavior, anchorable: AnchorableState, y: number}[]} */
  const anchorables = []
  logger.debug({ meshes }, `loads meshes`)

  // makes sure all meshes are created
  for (const state of meshes) {
    let mesh = scene.getMeshById(state.id)
    const name = state.shape
    const stackable = state.stackable ? clone(state.stackable) : undefined
    const anchorable = state.anchorable ? clone(state.anchorable) : undefined
    if (mesh) {
      logger.debug({ state, mesh }, `updates ${name} ${state.id}`)
      disposables.delete(mesh)
      mesh.setAbsolutePosition(new Vector3(state.x, state.y, state.z))
      mesh.computeWorldMatrix(true)
      restoreBehaviors(mesh.behaviors, state)
    } else {
      logger.debug({ state }, `create new ${name} ${state.id}`)
      mesh = await createMeshFromState(skipDelayableBehaviors(state), scene)
    }
    const stackBehavior = mesh.getBehaviorByName(StackBehaviorName)
    if (stackable && stackBehavior) {
      if ((stackable.stackIds?.length ?? 0) > 0) {
        // stores for later
        stackables.push({
          stackBehavior,
          stackable,
          y: mesh.absolutePosition.y
        })
      } else {
        // reset stacks
        stackBehavior.fromState(stackable)
      }
    }
    const anchorBehavior = mesh.getBehaviorByName(AnchorBehaviorName)
    if (anchorable && anchorBehavior) {
      if ((anchorable.anchors ?? []).find(({ snappedId }) => snappedId)) {
        // stores for later
        anchorables.push({
          anchorBehavior,
          anchorable,
          y: mesh.absolutePosition.y
        })
      } else {
        // reset anchors
        anchorBehavior.fromState(anchorable)
      }
    }
  }
  // dispose existing ones that are not meant to stay
  for (const mesh of disposables) {
    logger.debug({ mesh }, `dispose mesh ${mesh.id}`)
    mesh.dispose()
  }
  // now that all mesh are available, restore all stacks and anchors, starting from lowest
  for (const { stackBehavior, stackable } of stackables.sort(
    (a, b) => a.y - b.y
  )) {
    stackBehavior.fromState(stackable)
  }
  for (const { anchorBehavior, anchorable } of anchorables.sort(
    (a, b) => a.y - b.y
  )) {
    anchorBehavior.fromState(anchorable)
  }
}

/**
 * @param {SerializedMesh} mesh - serialized mesh to trim.
 * @return {SerializedMesh} the same mesh without its anchorable and stackable behaviors.
 */
function skipDelayableBehaviors({ stackable, anchorable, ...state }) {
  return {
    ...state,
    anchorable: anchorable ? { ...anchorable, anchors: [] } : undefined,
    stackable: stackable ? { ...stackable, stackIds: undefined } : undefined
  }
}

/**
 * Recursively removes null values (graphQL doesn't return undefined, which prevents from applying default values)
 * @template T
 * @param {T} object - sanitized object
 * @returns {Exclude<T, null>} a cloned object with no null values.
 */
export function removeNulls(object) {
  if (object === null) {
    // @ts-expect-error
    return
  }
  let result = object
  if (Array.isArray(object)) {
    // @ts-expect-error
    result = new Array(object.length)
    for (const [rank, item] of object.entries()) {
      // @ts-expect-error
      result[rank] = removeNulls(item)
    }
  } else if (typeof object === 'object') {
    // @ts-expect-error
    result = {}
    for (const key in object) {
      // @ts-expect-error
      result[key] = removeNulls(object[key])
    }
  }
  // @ts-expect-error
  return result
}
