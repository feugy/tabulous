// mandatory side effect
import '@babylonjs/core/Loading/loadingScreen.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import {
  createBox,
  createCard,
  createCustom,
  createPrism,
  createRoundToken,
  createRoundedTile
} from '../meshes'
import { restoreBehaviors } from './behaviors'
import { AnchorBehaviorName, StackBehaviorName } from '../behaviors/names'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('scene-loader')

const meshCreatorByName = new Map([
  ['box', createBox],
  ['card', createCard],
  ['custom', createCustom],
  ['prism', createPrism],
  ['roundToken', createRoundToken],
  ['roundedTile', createRoundedTile]
])

const supportedNames = new Set([...meshCreatorByName.keys()])

/**
 * Indicates whether a mesh can be serialized and loaded
 * @param {import('@babel/core').Mesh} mesh - tested mesh.
 * @returns {boolean} whether this mesh could be serialized and loaded.
 */
export function isSerializable(mesh) {
  return supportedNames.has(mesh.name)
}

/**
 * Serializes a scene's meshes.
 * @param {import('@babel/core').Scene} scene - 3D scene serialized.
 * @returns {object[]} list of serialized meshes TODO.
 */
export function serializeMeshes(scene) {
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
 * @param {object} state - serialized mesh state.
 * @param {import('@babel/core').Scene} scene - 3D scene used.
 * @returns {import('@babel/core').Mesh} mesh created
 */
export function createMeshFromState(state, scene) {
  const { shape } = state
  logger.debug({ state }, `create new ${shape} ${state.id}`)
  return meshCreatorByName.get(shape)(state, scene)
}

/**
 * Loads meshes into the provided scene:
 * - either creates new mesh, or updates existing ones, based on their ids
 * - deletes existing mesh that are not found in the provided data
 * @param {import('@babel/core').Scene} scene - 3D scene used.
 * @param {object[]} meshes - a list of serialized meshes data TODO.
 */
export function loadMeshes(scene, meshes) {
  const disposables = new Set(scene.meshes)
  for (const mesh of disposables) {
    if (!isSerializable(mesh)) {
      disposables.delete(mesh)
    }
  }

  const stackables = []
  const anchorables = []
  logger.debug({ meshes }, `loads meshes`)

  // makes sure all meshes are created
  for (const state of meshes) {
    let mesh = scene.getMeshById(state.id)
    const { stackable, anchorable, shape: name } = state
    if (mesh) {
      logger.debug({ state, mesh }, `updates ${name} ${state.id}`)
      disposables.delete(mesh)
      mesh.setAbsolutePosition(new Vector3(state.x, state.y, state.z))
      mesh.computeWorldMatrix(true)
      restoreBehaviors(mesh.behaviors, state)
    } else {
      logger.debug({ state }, `create new ${name} ${state.id}`)
      mesh = createMeshFromState(skipDelayableBehaviors(state), scene)
    }
    const stackBehavior = mesh.getBehaviorByName(StackBehaviorName)
    if (stackBehavior) {
      if (stackable?.stackIds?.length > 0) {
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
    if (anchorBehavior) {
      if (anchorable?.anchors.find(({ snappedId }) => snappedId)) {
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

function skipDelayableBehaviors({ stackable, anchorable, ...state }) {
  return {
    ...state,
    anchorable: anchorable ? { ...anchorable, anchors: [] } : undefined,
    stackable: stackable ? { ...stackable, stackIds: undefined } : undefined
  }
}

/**
 * Recursively removes null values (graphQL doesn't return undefined, which prevents from applying default values)
 * @param {object} object - sanitized object
 * @returns {object} a cloned object with no null values.
 */
export function removeNulls(object) {
  if (object === null) {
    return
  }
  let result = object
  if (Array.isArray(object)) {
    result = new Array(object.length)
    for (const [rank, item] of object.entries()) {
      result[rank] = removeNulls(item)
    }
  } else if (typeof object === 'object') {
    result = {}
    for (const key in object) {
      result[key] = removeNulls(object[key])
    }
  }
  return result
}
