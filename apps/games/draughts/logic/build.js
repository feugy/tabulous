// @ts-check
import { buildBoard, buildPawns } from './builders/index.js'
import { blackId, counts, whiteId } from './constants.js'

/** @type {import('@tabulous/server/src/services/catalog').Build} */
export function build() {
  // 20 white pawns, 20 black pawns
  const meshes = [...buildPawns(), buildBoard()]

  // Bags to randomize: one for white pawns, one for black ones
  const bags = new Map([
    [whiteId, makeIds(whiteId, counts.pawns)],
    [blackId, makeIds(blackId, counts.pawns)]
  ])

  // Pre-defined slots: one for each pawn, on board anchors
  const slots = [...makeSlots(whiteId), ...makeSlots(blackId, 6)]

  return { meshes, bags, slots }
}

function makeIds(/** @type {string} */ kind, /** @type {number} */ length) {
  return Array.from({ length }, (_, rank) => `${kind}-${rank + 1}`)
}

function makeSlots(/** @type {string} */ bagId, startRow = 0) {
  const slots = []
  for (let row = startRow; row < startRow + 5; row++) {
    for (let column = 0; column < counts.columns; column++) {
      if ((row % 2 && column % 2) || (!(row % 2) && !(column % 2))) {
        slots.push({ bagId, anchorId: `pawn-${column}-${row}`, count: 1 })
      }
    }
  }
  return slots
}
