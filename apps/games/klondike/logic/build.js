// @ts-check
import { buildBoard, buildCards } from './builders/index.js'
import { anchorIds } from './constants.js'

const bagId = 'cards'

/** @type {import('@tabulous/types').Build} */
export function build() {
  /**
   * 13 cards of each suit: spades, diamonds, clubs, hearts.
   * +
   * 1 board for all cards
   */
  const meshes = [...buildCards(), buildBoard()]

  /**
   * Bags to randomize:
   * - one for all remaining cards
   */
  const bags = new Map([[bagId, meshes.slice(0, -1).map(({ id }) => id)]])

  /**
   * Pre-define slots: 1 on first column, 2 on second column, and so on.
   * Remainings are on discard
   */
  const slots = [
    { bagId, anchorId: anchorIds.reserve, flippable: { isFlipped: true } }
  ]

  return { meshes, bags, slots }
}
