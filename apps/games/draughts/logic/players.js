import {
  buildCameraPosition,
  findAvailableValues
} from '@tabulous/server/src/utils/index.js'

import { blackId, cameraPositions, whiteId } from './constants.js'

export function askForParameters({ game: { preferences } }) {
  const sides = findAvailableValues(preferences, 'side', [whiteId, blackId])
  return sides.length <= 1
    ? null
    : {
        type: 'object',
        additionalProperties: false,
        properties: {
          side: {
            description: 'color',
            enum: sides,
            metadata: { fr: { name: 'Couleur' }, en: { name: 'Color' } }
          }
        },
        required: ['side']
      }
}

export function addPlayer(game, player, parameters) {
  const { cameras, preferences } = game
  // use selected preferences, or look for the first player color, and choose the other one.
  const side =
    preferences.length === 2
      ? preferences[0].side === whiteId
        ? blackId
        : whiteId
      : parameters.side
  // stores preferences for the next player added.
  preferences[preferences.length - 1].side = side
  preferences[preferences.length - 1].color =
    game.colors.players[side === whiteId ? 0 : 1]
  // set camera based on selected side.
  cameras.push(
    buildCameraPosition({
      playerId: player.id,
      ...cameraPositions[side]
    })
  )
  return game
}
