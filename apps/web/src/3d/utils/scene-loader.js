// mandatory side effect
import '@babylonjs/core/Loading/loadingScreen'
import { createCard } from '../card'
import { createRoundToken } from '../round-token'
import { createRoundedTile } from '../rounded-tile'
import { restoreBehaviors } from './behaviors'
import { StackBehaviorName } from '../behaviors/names'
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
  logger.debug({ meshes }, `loads meshes`)

  // makes sure all meshes are created
  for (const state of meshes) {
    let mesh = scene.getMeshById(state.id)
    const { stackable, shape: name } = state
    if (mesh) {
      logger.debug({ state, mesh }, `updates ${name} ${state.id}`)
      disposables.delete(mesh)
      mesh.position.copyFromFloats(state.x, state.y, state.z)
      restoreBehaviors(mesh.behaviors, state)
    } else {
      logger.debug({ state }, `create new ${name} ${state.id}`)
      mesh = meshCreatorByName.get(name)(
        removeNulls(state, {
          stackable: stackable ? { ...stackable, stack: undefined } : undefined
        })
      )
    }
    const behavior = mesh.getBehaviorByName(StackBehaviorName)
    if (behavior) {
      if (stackable?.stack?.length > 0) {
        // stores for later
        stackables.push({ behavior, stackable })
      } else {
        // reset stacks
        behavior.fromState(stackable)
      }
    }
  }
  // dispose existing ones that are not meant to stay
  for (const mesh of disposables) {
    logger.debug({ mesh }, `dispose mesh ${mesh.id}`)
    mesh.dispose()
  }
  // now that all mesh are available, restore all stacks
  for (const { behavior, stackable } of stackables) {
    behavior.fromState(stackable)
  }
}

const meshCreatorByName = new Map([
  ['card', createCard],
  ['roundToken', createRoundToken],
  ['roundedTile', createRoundedTile]
])

const supportedNames = [...meshCreatorByName.keys()]

function removeNulls(object, extension = {}) {
  const result = extension
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
