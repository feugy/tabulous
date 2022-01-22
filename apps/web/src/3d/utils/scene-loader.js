// mandatory side effect
import '@babylonjs/core/Loading/loadingScreen'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { createCard } from '../card'
import { createRoundToken } from '../round-token'
import { createRoundedTile } from '../rounded-tile'
import { restoreBehaviors } from './behaviors'
import { AnchorBehaviorName, StackBehaviorName } from '../behaviors/names'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('scene-loader')

/**
 * Serializes engine's meshes.
 * @param {import('@babel/core').Engine} engine - 3D engine used.
 * @returns {object[]} list of serialized meshes TODO.
 */
export function serializeMeshes(engine) {
  if (!engine.scenes.length) return
  const meshes = []
  for (const mesh of engine.scenes[0].meshes) {
    if (supportedNames.includes(mesh.name)) {
      meshes.push(mesh.metadata.serialize())
    }
  }
  logger.debug({ meshes }, `serialize meshes`)
  return meshes
}

/**
 * Loads meshes into the provided engine:
 * - either creates new mesh, or updates existing ones, based on their ids
 * - deletes existing mesh that are not found in the provided data
 * - shows and hides Babylon's loading UI while loading asset (initial loading only)
 * @param {import('@babel/core').Engine} engine - 3D engine used.
 * @param {object} meshes - list of loaded meshes TODO.
 * @param {boolean} [initial = true] - indicates whether this is the first loading or not.
 */
export function loadMeshes(engine, meshes, initial = true) {
  if (!engine.scenes.length) return
  const [scene] = engine.scenes
  if (initial) {
    engine.displayLoadingUI()
    scene.onDataLoadedObservable.addOnce(() => engine.hideLoadingUI())
  }
  const disposables = new Set(scene.meshes)
  for (const mesh of disposables) {
    if (!supportedNames.includes(mesh.name)) {
      disposables.delete(mesh)
    }
  }

  const stackables = []
  const anchorables = []
  logger.debug({ meshes }, `loads meshes`)

  // makes sure all meshes are created
  for (const rawState of meshes) {
    const state = removeNulls(rawState)
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
      mesh = meshCreatorByName.get(name)({
        ...state,
        anchorable: anchorable ? { ...anchorable, anchors: [] } : undefined,
        stackable: stackable ? { ...stackable, stackIds: undefined } : undefined
      })
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

const meshCreatorByName = new Map([
  ['card', createCard],
  ['roundToken', createRoundToken],
  ['roundedTile', createRoundedTile]
])

const supportedNames = [...meshCreatorByName.keys()]

function removeNulls(object) {
  const result = {}
  for (const key in object) {
    const prop = object[key]
    if (prop !== null) {
      result[key] =
        !Array.isArray(prop) && typeof prop === 'object'
          ? removeNulls(prop)
          : prop
    }
  }
  return result
}
