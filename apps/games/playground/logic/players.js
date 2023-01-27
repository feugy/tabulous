import { buildCards, buildDice } from './build.js'

export function askForParameters({ game: { preferences } }) {
  return preferences.length
    ? null
    : {
        type: 'object',
        additionalProperties: false,
        properties: {
          cardCount: {
            type: 'number',
            enum: [54, 32, 0],
            metadata: {
              fr: {
                name: 'Nombre de cartes dans le paquet',
                0: 'Aucunes'
              }
            }
          },
          die4Count: {
            type: 'number',
            enum: [0, 1, 2, 3, 4, 5],
            metadata: {
              fr: {
                name: 'Nombre de dés à 4 faces',
                0: 'Aucun'
              }
            }
          },
          die6Count: {
            type: 'number',
            enum: [0, 1, 2, 3, 4, 5],
            metadata: {
              fr: {
                name: 'Nombre de dés à 6 faces',
                0: 'Aucun'
              }
            }
          },
          die8Count: {
            type: 'number',
            enum: [0, 1, 2, 3, 4, 5],
            metadata: {
              fr: {
                name: 'Nombre de dés à 8 faces',
                0: 'Aucun'
              }
            }
          }
        },
        required: ['cardCount', 'die4Count', 'die6Count', 'die8Count']
      }
}

export function addPlayer(game, player, parameters) {
  if (parameters) {
    const { cardCount, die4Count, die6Count, die8Count } = parameters
    let offset = 0
    if (cardCount) {
      game.meshes.push(...buildCards(cardCount === 54))
    }
    if (die4Count) {
      game.meshes.push(...buildDice(4, die4Count, (offset -= 3)))
    }
    if (die6Count) {
      game.meshes.push(...buildDice(6, die6Count, (offset -= 3)))
    }
    if (die8Count) {
      game.meshes.push(...buildDice(8, die8Count, (offset -= 3)))
    }
  }
  return game
}
