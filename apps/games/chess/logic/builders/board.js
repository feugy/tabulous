// @ts-check
import { blackId, faceUVs, pieces, sizes, whiteId } from '../constants.js'

/** @returns {import('@tabulous/types').Mesh} */
export function buildBoard() {
  return {
    shape: 'roundedTile',
    id: 'board',
    texture: 'board.ktx2',
    faceUV: faceUVs.board,
    y: sizes.board.height / 2,
    ...sizes.board,
    anchorable: { anchors: buildAnchors() }
  }
}

/** @returns {import('@tabulous/types').Anchor[]} */
function buildAnchors() {
  const anchors = []
  const max = pieces.length
  const x = sizes.tile * (max * -0.5 + 0.5)
  for (let column = 0; column < max; column++) {
    for (let row = 0; row < max; row++) {
      const pieceId = getPieceId({ column, row })
      anchors.push({
        id: `tile-${column}-${row}`,
        x: x + sizes.tile * column,
        y: sizes.board.height * 0.5,
        z: x + sizes.tile * row,
        width: sizes.tile,
        depth: sizes.tile,
        height: 0.01,
        snappedIds: pieceId ? [pieceId] : []
      })
    }
  }
  return anchors
}

function getPieceId(
  /** @type {{ column: number, row: number }} */ { column, row }
) {
  return row === 0
    ? `${[whiteId]}-${pieces[column]}`
    : row === pieces.length - 1
    ? `${[blackId]}-${pieces[column]}`
    : row === 1
    ? `${[whiteId]}-pawn-${column}`
    : row === pieces.length - 2
    ? `${[blackId]}-pawn-${column}`
    : null
}
