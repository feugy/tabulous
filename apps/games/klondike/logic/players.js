// @ts-check
import { buildCameraPosition } from '@tabulous/server/src/utils/index.js'

/** @type {import('@tabulous/server/src/services/catalog').AddPlayer<?>} */
export function addPlayer(game, player) {
  game.cameras.push(
    buildCameraPosition({
      playerId: player.id,
      target: [0, 0, -2],
      elevation: 30
    })
  )
  return game
}
