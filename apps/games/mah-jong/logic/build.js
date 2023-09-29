// @ts-check
import { buildDice, buildMainBoard, buildTiles } from './builders/index.js'
import { buildDealerMark } from './builders/marks.js'
import { walls, wallSize } from './constants.js'

/** @type {import('@tabulous/types').Build} */
export function build() {
  const tiles = buildTiles()
  const bagId = 'tiles-bag'

  /**
   * - one invisible board with wall and river anchors
   * - 4x9 tiles of each suit: man, pei, sou.
   * - 4x4 winds
   * - 4x3 dragons
   * - 2x6-faces dice
   * - 1 dealer mark
   */
  const meshes = [buildMainBoard(), ...tiles, ...buildDice(), buildDealerMark()]

  /**
   * Bags to randomize:
   * - one for all tiles
   */
  const bags = new Map([[bagId, tiles.map(({ id }) => id)]])

  /**
   * Pre-define slots:
   * - each of the 4 walls has 17 anchors
   * - each snapped tile has another tile stacked
   */
  const slots = [
    ...Object.values(walls).flatMap(wall =>
      Array.from({ length: wallSize }, (_, rank) => ({
        bagId,
        count: 2,
        anchorId: `${wall}-${rank + 1}`
      }))
    )
  ]

  return { meshes, bags, slots }
}
