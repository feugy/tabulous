// @ts-check
/**
 * @typedef {import('@tabulous/server/src/graphql').Anchor} Anchor
 * @typedef {import('@tabulous/server/src/graphql').Mesh} Mesh
 */

import { counts, faceUVs, sizes } from '../constants.js'

/** @returns {Mesh} */
export function buildBoard() {
  return {
    shape: 'roundedTile',
    id: 'board',
    texture: 'board.ktx2',
    faceUV: faceUVs.board,
    y: sizes.board.height / 2,
    ...sizes.board,
    anchorable: { anchors: buildPawnAnchors() }
  }
}

function buildPawnAnchors() {
  /** @type {Anchor[]} */
  const anchors = []
  const spacing = {
    x: sizes.board.width / counts.columns,
    z: sizes.board.depth / counts.columns
  }
  const position = {
    x: sizes.board.width * -0.5 + (sizes.board.width / counts.columns) * 0.5,
    y: sizes.board.height,
    z: sizes.board.depth * -0.5 + (sizes.board.depth / counts.columns) * 0.5
  }
  for (let column = 0; column < counts.columns; column++) {
    for (let row = 0; row < counts.columns; row++) {
      if ((row % 2 && column % 2) || (!(row % 2) && !(column % 2))) {
        anchors.push({
          id: `pawn-${column}-${row}`,
          x: position.x + spacing.x * column,
          y: position.y,
          z: position.z + spacing.z * row,
          ...sizes.pawn,
          height: 0.01
        })
      }
    }
  }
  return anchors
}
