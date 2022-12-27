import { buildBoard, buildPieces } from './builders/index.js'
import { black, white } from './constants.js'

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
     * @type {import('@tabulous/server/src/services/games').Mesh[]}
     */
    meshes: [buildBoard(), ...buildPieces(white), ...buildPieces(black)]
  }
}
