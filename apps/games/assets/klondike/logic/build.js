import { buildBoard, buildCards } from './builders/index.js'
import { anchorIds, counts } from './constants.js'

const bagId = 'cards'

export function build() {
  /**
   * 13 cards of each suit: spades, diamonds, clubs, hearts.
   * +
   * 1 board for all cards
   * @type {import('@tabulous/server/src/services/games').Mesh[]}
   */
  const meshes = [...buildCards(), buildBoard()]

  /**
   * Bags to randomize:
   * - one for all remaining cards
   * @type {Map<string, string[]>}
   */
  const bags = new Map([[bagId, meshes.slice(0, -1).map(({ id }) => id)]])

  /**
   * Pre-define slots: 1 on first column, 2 on second column, and so on.
   * Remainings are on discard
   * @type {import('@tabulous/server/src/services/utils').Slot[]}
   */
  const slots = [
    ...makeColumnSlots(),
    { bagId, anchorId: anchorIds.reserve, flippable: { isFlipped: true } }
  ]

  return { meshes, bags, slots }
}

function makeColumnSlots() {
  const slots = []
  for (let column = 0; column < counts.columns; column++) {
    for (let row = 0; row <= column; row++) {
      let anchorId = `${anchorIds.column}-${column + 1}`
      for (let index = 0; index < row; index++) {
        anchorId += '.bottom'
      }
      slots.push({
        bagId,
        anchorId,
        count: 1,
        flippable: row !== column ? { isFlipped: true } : undefined
      })
    }
  }
  return slots
}
