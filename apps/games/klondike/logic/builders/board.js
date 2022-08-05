import {
  anchorIds,
  counts,
  faceUVs,
  positions,
  sizes,
  spacing,
  suits
} from '../constants.js'

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
        { id: anchorIds.reserve, ...positions.reserve, ...sizes.card },
        { ...positions.discard, ...sizes.card },
        ...buildGoalAnchors(),
        ...buildColumnAnchors()
      ]
    }
  }
}

function buildGoalAnchors() {
  const anchors = []
  for (const [column, suit] of suits.entries()) {
    anchors.push({
      x: positions.goal.x + spacing.column.x * column,
      z: positions.goal.z,
      ...sizes.card,
      kinds: [suit]
    })
  }
  return anchors
}

function buildColumnAnchors() {
  const anchors = []
  for (let column = 0; column < counts.columns; column++) {
    anchors.push({
      id: `${anchorIds.column}-${column + 1}`,
      x: positions.column.x + spacing.column.x * column,
      z: positions.column.z,
      ...sizes.card
    })
  }
  return anchors
}
