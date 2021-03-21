import { createCard } from '../card'
import { createRoundToken } from '../round-token'
import { makeLogger } from '../../utils'

const logger = makeLogger('scene-loader')

export function serializeScene(scene) {
  const data = {
    cards: [],
    roundTokens: []
  }
  for (const mesh of scene.meshes) {
    if (mesh.name === 'card') {
      data.cards.push(mesh.metadata.serialize())
    } else if (mesh.name === 'round-token') {
      data.roundTokens.push(mesh.metadata.serialize())
    }
  }
  logger.debug({ data }, `serialize scene`)
  return data
}

export function loadScene(scene, data) {
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
    const mesh = createCard({ ...card, stack: undefined })
    meshById.set(mesh.id, mesh)
  }
  for (const token of data.roundTokens) {
    logger.debug({ token }, `create new round token ${token.id}`)
    const mesh = createRoundToken({ ...token, stack: undefined })
    meshById.set(mesh.id, mesh)
  }
  for (const { stack, id } of [...data.cards, ...data.roundTokens]) {
    if (stack?.length) {
      for (const stackedId of stack) {
        logger.debug({ stackedId, id }, `push ${stackedId} on top of ${id}`)
        // TODO prevent triggering control manager
        scene.getMeshByID(id).metadata.push(stackedId)
      }
    }
  }
}
