// @ts-check
import { buildBoard, buildPieces } from './builders/index.js'
import { blackId, whiteId } from './constants.js'

/** @type {import('@tabulous/server/src/services/catalog').Build} */
export function build() {
  return {
    /**
     * For each color (white, black):
     * - 1 queen
     * - 1 king
     * - 2 rooks
     * - 2 bishops
     * - 2 knights
     * - 8 pawns
     * and the game board.
     */
    meshes: [buildBoard(), ...buildPieces(whiteId), ...buildPieces(blackId)]
  }
}
