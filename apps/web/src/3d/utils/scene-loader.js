// mandatory side effect
import '@babylonjs/core/Loading/loadingScreen'
import {
  createBoard,
  createCard,
  createRoundToken,
  createRoundedTile
} from '..'
import { restoreBehaviors } from './behaviors'
import { StackBehaviorName } from '../behaviors/names'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('scene-loader')

export function serializeScene(engine) {
  if (!engine.scenes.length) return
  const data = {
    cards: [],
    roundTokens: [],
    roundedTiles: [],
    boards: []
  }
  for (const mesh of engine.scenes[0].meshes) {
    if (mesh.name === 'card') {
      data.cards.push(mesh.metadata.serialize())
    } else if (mesh.name === 'round-token') {
      data.roundTokens.push(mesh.metadata.serialize())
    } else if (mesh.name === 'rounded-tile') {
      data.roundedTiles.push(mesh.metadata.serialize())
    } else if (mesh.name === 'board') {
      data.boards.push(mesh.metadata.serialize())
    }
  }
  logger.debug({ data }, `serialize scene`)
  return data
}

/**
 * Loads meshes into the provided engine:
 * - either creates new mesh, or updates existing ones, based on their ids
 * - deletes existing mesh that are not found in the provided data
 * - shows and hides Babylon's loading UI while loading asset (initial loading only)
 * @param {import('@babel/core').Engine} engine - 3D engine used.
 * @param {object} data - the loaded scene data TODO.
 * @param {boolean} [initial = true] - indicates whether this is the first loading or not.
 */
export function loadScene(engine, data, initial = true) {
  if (!engine.scenes.length) return
  const [scene] = engine.scenes
  if (initial) {
    engine.displayLoadingUI()
    scene.onDataLoadedObservable.addOnce(() => engine.hideLoadingUI())
  }
  const disposables = new Set(scene.meshes)
  for (const mesh of disposables) {
    if (!['card', 'round-token', 'rounded-tile', 'board'].includes(mesh.name)) {
      disposables.delete(mesh)
    }
  }

  const stackables = []
  logger.debug({ data }, `load new scene`)

  const sources = [
    { factory: createCard, source: data?.cards ?? [], name: 'card' },
    {
      factory: createRoundToken,
      source: data?.roundTokens ?? [],
      name: 'round token'
    },
    {
      factory: createRoundedTile,
      source: data?.roundedTiles ?? [],
      name: 'rounded tile'
    },
    { factory: createBoard, source: data?.boards ?? [], name: 'board' }
  ]

  // makes sure all meshes are created
  for (const { factory, source, name } of sources) {
    for (const state of source) {
      let mesh = scene.getMeshById(state.id)
      const { stackable } = state
      if (mesh) {
        logger.debug({ state, mesh }, `updates ${name} ${state.id}`)
        disposables.delete(mesh)
        mesh.position.copyFromFloats(state.x, state.y, state.z)
        restoreBehaviors(mesh.behaviors, state)
      } else {
        logger.debug({ state }, `create new ${name} ${state.id}`)
        mesh = factory({
          ...state,
          stackable: stackable ? { ...stackable, stack: undefined } : undefined
        })
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
