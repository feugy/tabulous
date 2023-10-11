// @ts-check
import { counts, faceUVs, ids, sizes } from '../constants.js'

/** @returns {import('@tabulous/types').Mesh} */
export function buildBoard() {
  return {
    shape: 'roundedTile',
    id: ids.board,
    texture: 'board.ktx2',
    faceUV: faceUVs.board,
    y: sizes.board.height / 2,
    ...sizes.board,
    anchorable: { anchors: [...buildPawnAnchors(), buildScoreAnchor()] }
  }
}

function buildPawnAnchors() {
  /** @type {import('@tabulous/types').Anchor[]} */
  const anchors = []
  const spacing = {
    x: sizes.board.width / counts.columns,
    z: sizes.board.depth / counts.columns
  }
  const position = {
    x: sizes.board.width * -0.5 + (sizes.board.width / counts.columns) * 0.5,
    y: sizes.board.height * 0.5,
    z: sizes.board.depth * -0.5 + (sizes.board.depth / counts.columns) * 0.5
  }
  for (let column = 0; column < counts.columns; column++) {
    for (let row = 0; row < counts.columns; row++) {
      if ((row % 2 && column % 2) || (!(row % 2) && !(column % 2))) {
        anchors.push({
          id: `${ids.pawnAnchor}-${column}-${row}`,
          x: position.x + spacing.x * column,
          y: position.y,
          z: position.z + spacing.z * row,
          ...sizes.pawn,
          height: 0.01,
          snappedIds: []
        })
      }
    }
  }
  return anchors
}

/** @returns {import('@tabulous/types').Anchor} */
function buildScoreAnchor() {
  const extent = 1.5
  return {
    id: ids.scoreAnchor,
    y: sizes.board.height * -0.5,
    width: sizes.board.width * extent,
    height: 0.01,
    depth: sizes.board.depth * extent,
    snappedIds: [],
    max: counts.pawns * 2
  }
}
