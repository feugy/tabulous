import { buildCameraPosition } from '@tabulous/server/src/utils/index.js'

import { blackId, cameraPositions, whiteId } from './constants.js'

export function addPlayer(game, player) {
  const { cameras, playerIds } = game
  const rank = playerIds.length
  cameras.push(
    buildCameraPosition({
      playerId: player.id,
      ...cameraPositions[rank === 1 ? whiteId : blackId]
    })
  )
  return game
}
