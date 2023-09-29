// @ts-check
import { buildCards, buildDice } from './build.js'

/**
 * @typedef {object} Parameters
 * @property {number} cardCount - How many cards in the deck: 54, 3é, 0.
 * @property {number} die4Count - 'How many 4-faces die: 0~5.
 * @property {number} die6Count - 'How many 6-faces die: 0~5.
 * @property {number} die8Count - 'How many 8-faces die: 0~5.
 */

/** @type {import('@tabulous/types').AskForParameters<Parameters>} */
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
              fr: { name: 'Nombre de cartes dans le paquet', 0: 'Aucunes' },
              en: { name: 'How many cards in the deck', 0: 'None' }
            }
          },
          die4Count: {
            type: 'number',
            enum: [0, 1, 2, 3, 4, 5],
            metadata: {
              fr: { name: 'Nombre de dés à 4 faces', 0: 'Aucun' },
              en: { name: 'How many 4-faces die', 0: 'None' }
            }
          },
          die6Count: {
            type: 'number',
            enum: [0, 1, 2, 3, 4, 5],
            metadata: {
              fr: { name: 'Nombre de dés à 6 faces', 0: 'Aucun' },
              en: { name: 'How many 6-faces die', 0: 'None' }
            }
          },
          die8Count: {
            type: 'number',
            enum: [0, 1, 2, 3, 4, 5],
            metadata: {
              fr: { name: 'Nombre de dés à 8 faces', 0: 'Aucun' },
              en: { name: 'How many 8-faces die', 0: 'None' }
            }
          }
        },
        required: ['cardCount', 'die4Count', 'die6Count', 'die8Count']
      }
}

/** @type {import('@tabulous/types').AddPlayer<Parameters>} */
export function addPlayer(game, player, parameters) {
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
  return game
}
