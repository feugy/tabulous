import { createCard } from '../card'
import { makeLogger } from '../../utils'

const logger = makeLogger('scene-loader')

export function serializeScene(scene) {
  const data = {
    cards: []
  }
  for (const mesh of scene.meshes) {
    if (mesh.name === 'card') {
      data.cards.push(mesh.metadata.serialize())
    }
  }
  logger.debug({ data }, `serialize scene`)
  return data
}

export function loadScene(scene, data) {
  const disposed = new Array(scene.meshes.length)
  let j = 0
  for (let i = 0; i < disposed.length; i++) {
    if (scene.meshes[i].name === 'card') {
      disposed[j++] = scene.meshes[i]
    }
  }
  disposed.splice(j)
  for (const card of disposed) {
    logger.debug({ card }, `dispose card ${card.id}`)
    card.dispose()
  }

  const meshById = new Map()
  logger.debug({ data }, `load new scene`)

  for (const card of data.cards) {
    logger.debug({ card }, `create new card ${card.id}`)
    const mesh = createCard({ ...card, stack: undefined })
    meshById.set(mesh.id, mesh)
  }
  for (const { stack, id } of data.cards) {
    if (stack?.length) {
      for (const stackedId of stack) {
        logger.debug({ stackedId, id }, `push ${stackedId} on top of ${id}`)
        // TODO prevent triggering control manager
        scene.getMeshByID(id).metadata.push(stackedId)
      }
    }
  }
}
