import {
  buildCameraPosition,
  findAvailableValues
} from '@tabulous/server/src/utils/index.js'

import { buildSticks } from './builders/index.js'
import { colors } from './constants.js'

export function askForParameters({ game: { preferences } }) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      color: {
        description: 'color',
        enum: findAvailableValues(preferences, 'color', colors.players),
        metadata: { fr: { name: 'Couleur' } }
      }
    }
  }
}

/**
 * Set player angle and camera position based on their rank:
 * - first is looking toward north,
 * - second is looking toward west,
 * - third is looking toward south,
 * - fourth is looking toward east
 * Then creates sticks for counting points
 * @param {TODO} game - game data, including meshes and hands.
 * @param {TODO} player - joining player.
 * @returns {TODO} altered game data.
 */
export function addPlayer(game, player) {
  const rank = game.preferences.length - 1
  const angle = Math.PI * 0.5 * rank
  Object.assign(game.preferences[rank], { angle })

  game.meshes.push(...buildSticks(rank))

  game.cameras.push(
    buildCameraPosition({
      playerId: player.id,
      elevation: 50,
      alpha: (3 * Math.PI) / 2 - angle,
      beta: Math.PI / 4,
      target:
        rank === 0
          ? [0, 0, -12]
          : rank === 1
          ? [-12, 0, 0]
          : rank === 2
          ? [0, 0, 12]
          : [12, 0, 0]
    })
  )
  return game
}
