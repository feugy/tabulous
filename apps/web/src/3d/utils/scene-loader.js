import { createCard, createRoundToken, createRoundedTile } from '..'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('scene-loader')

export function serializeScene(engine) {
  if (!engine.scenes.length) return
  const data = {
    cards: [],
    roundTokens: [],
    roundedTiles: []
  }
  for (const mesh of engine.scenes[0].meshes) {
    if (mesh.name === 'card') {
      data.cards.push(mesh.metadata.serialize())
    } else if (mesh.name === 'round-token') {
      data.roundTokens.push(mesh.metadata.serialize())
    } else if (mesh.name === 'rounded-tile') {
      data.roundedTiles.push(mesh.metadata.serialize())
    }
  }
  logger.debug({ data }, `serialize scene`)
  return data
}

export function loadScene(engine, data) {
  if (!engine.scenes.length) return
  const [scene] = engine.scenes
  engine.displayLoadingUI()
  scene.onDataLoadedObservable.addOnce(() => engine.hideLoadingUI())
  const disposed = new Array(scene.meshes.length)
  let j = 0
  for (let i = 0; i < disposed.length; i++) {
    const mesh = scene.meshes[i]
    if (mesh.name === 'card' || mesh.name === 'round-token') {
      disposed[j++] = mesh
    }
  }
  disposed.splice(j)
  for (const mesh of disposed) {
    logger.debug({ mesh }, `dispose mesh ${mesh.id}`)
    mesh.dispose()
  }

  const meshById = new Map()
  logger.debug({ data }, `load new scene`)

  for (const card of data.cards) {
    logger.debug({ card }, `create new card ${card.id}`)
    const mesh = createCard({
      ...card,
      stack: undefined
    })
    meshById.set(mesh.id, mesh)
  }
  for (const token of data.roundTokens) {
    logger.debug({ token }, `create new round token ${token.id}`)
    const mesh = createRoundToken({
      ...token,
      stack: undefined
    })
    meshById.set(mesh.id, mesh)
  }
  for (const tile of data.roundedTiles) {
    logger.debug({ tile }, `create new rounded tile ${tile.id}`)
    const mesh = createRoundedTile({
      ...tile,
      stack: undefined
    })
    meshById.set(mesh.id, mesh)
  }
  for (const { stack, id } of [
    ...data.cards,
    ...data.roundTokens,
    ...data.roundedTiles
  ]) {
    if (stack?.length) {
      for (const stackedId of stack) {
        logger.debug({ stackedId, id }, `push ${stackedId} on top of ${id}`)
        // TODO prevent triggering control manager
        scene.getMeshById(id).metadata.push(stackedId)
      }
    }
  }
}
