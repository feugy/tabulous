import { buildCameraPosition } from '@tabulous/server/src/utils/index.js'

import { blackId, cameraPositions, whiteId } from './constants.js'

export function askForParameters({ game: { preferences } }) {
  const usedValues = preferences.map(({ side }) => side)
  return usedValues.length
    ? null
    : {
        type: 'object',
        additionalProperties: false,
        properties: {
          side: {
            type: 'string',
            enum: [whiteId, blackId].filter(
              value => !usedValues.includes(value)
            ),
            metadata: {
              fr: {
                name: 'Couleur',
                [whiteId]: 'Blancs',
                [blackId]: 'Noirs'
              }
            }
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
  // set camera based on selected side.
  cameras.push(
    buildCameraPosition({
      playerId: player.id,
      ...cameraPositions[side]
    })
  )
  return game
}
