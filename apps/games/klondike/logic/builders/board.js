// @ts-check
import {
  anchorIds,
  counts,
  faceUVs,
  positions,
  sizes,
  spacing,
  suits
} from '../constants.js'

/** @returns {import('@tabulous/types').Mesh} */
export function buildBoard() {
  return {
    shape: 'card',
    id: 'board',
    texture: `board.ktx2`,
    faceUV: faceUVs.board,
    ...positions.board,
    ...sizes.board,
    anchorable: {
      anchors: [
        {
          id: anchorIds.reserve,
          ...positions.reserve,
          ...sizes.card,
          snappedIds: []
        },
        {
          id: 'discard',
          ...positions.discard,
          ...sizes.card,
          flip: false,
          snappedIds: []
        },
        ...buildGoalAnchors(),
        ...buildColumnAnchors()
      ]
    }
  }
}

function buildGoalAnchors() {
  /** @type {import('@tabulous/types').Anchor[]} */
  const anchors = []
  for (const [column, suit] of suits.entries()) {
    anchors.push({
      id: `goal-${suit}`,
      x: positions.goal.x + spacing.column.x * column,
      z: positions.goal.z,
      ...sizes.card,
      kinds: [suit],
      snappedIds: []
    })
  }
  return anchors
}

function buildColumnAnchors() {
  /** @type {import('@tabulous/types').Anchor[]} */
  const anchors = []
  for (let column = 0; column < counts.columns; column++) {
    anchors.push({
      id: `${anchorIds.column}-${column + 1}`,
      x: positions.column.x + spacing.column.x * column,
      z: positions.column.z,
      ...sizes.card,
      snappedIds: []
    })
  }
  return anchors
}
