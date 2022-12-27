import { black, faceUVs, pieces, sizes, white } from '../constants.js'

export function buildBoard() {
  return {
    shape: 'roundedTile',
    id: 'board',
    texture: 'board.ktx2',
    faceUV: faceUVs.board,
    y: sizes.board.height / 2,
    ...sizes.board,
    lockable: { isLocked: true },
    anchorable: { anchors: buildAnchors() },
    movable: {}
  }
}

function buildAnchors() {
  const anchors = []
  const max = pieces.length
  const x = sizes.tile * (max * -0.5 + 0.5)
  for (let column = 0; column < max; column++) {
    for (let row = 0; row < max; row++) {
      anchors.push({
        id: `tile-${column}-${row}`,
        x: x + sizes.tile * column,
        y: sizes.board.height * 0.5,
        z: x + sizes.tile * row,
        width: sizes.tile,
        depth: sizes.tile,
        height: 0.01,
        snappedId: getPieceId({ column, row })
      })
    }
  }
  return anchors
}

function getPieceId({ column, row }) {
  return row === 0
    ? `${[white]}-${pieces[column]}`
    : row === pieces.length - 1
    ? `${[black]}-${pieces[pieces.length - 1 - column]}`
    : row === 1
    ? `${[white]}-pawn-${column}`
    : row === pieces.length - 2
    ? `${[black]}-pawn-${column}`
    : null
}
