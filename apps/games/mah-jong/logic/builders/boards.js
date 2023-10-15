// @ts-check
import {
  ids,
  kinds,
  positions,
  riverSize,
  shapes,
  stickQuantities,
  walls,
  wallSize
} from '../constants.js'

/** @returns {import('@tabulous/types').Mesh} */
export function buildMainBoard() {
  return {
    id: 'main-board',
    shape: 'card',
    texture: '#00000000',
    y: 0.01,
    anchorable: {
      anchors: Object.values(walls).flatMap(buildPlayerAnchors)
    }
  }
}

function buildPlayerAnchors(
  /** @type {import('../constants').Wall} */ wall,
  /** @type {number} */ rank
) {
  const params = {
    wall,
    wallCount: rank,
    invertX: rank === 3 ? -1 : 1,
    invertZ: rank === 0 ? 1 : -1,
    angle: rank * 0.5 * Math.PI,
    isHorizontal: rank % 2 === 0
  }
  return [
    ...buildWallAnchors(params),
    ...buildRiverAnchors(params),
    buildScoreAnchor(params)
  ]
}

function buildWallAnchors(
  /** @type {{ wall: import('../constants.js').Wall, invertX: number, invertZ: number, angle: number, isHorizontal: boolean }} */ {
    wall,
    invertX,
    invertZ,
    angle,
    isHorizontal
  }
) {
  /** @type {import('@tabulous/types').Anchor[]} */
  const anchors = []
  const { width, height, depth } = shapes.anchor
  const start = (width * wallSize - 2) * -0.5
  const gap = depth
  for (let rank = 0; rank < wallSize; rank++) {
    anchors.push({
      id: `${wall}-${rank + 1}`,
      kinds: [kinds.tile],
      x: start * invertX + (isHorizontal ? rank * width : gap * -invertX),
      z: start * invertZ + (isHorizontal ? gap * -invertZ : -rank * width),
      height,
      width: isHorizontal ? width : depth,
      depth: isHorizontal ? depth : width,
      angle,
      snappedIds: []
    })
  }
  return anchors
}

function buildRiverAnchors(
  /** @type {{ wall: import('../constants.js').Wall, invertX: number, invertZ: number, angle: number, isHorizontal: boolean }} */ {
    wall,
    invertX,
    invertZ,
    angle,
    isHorizontal
  }
) {
  /** @type {import('@tabulous/types').Anchor[]} */
  const anchors = []
  const { width, height, depth } = shapes.anchor
  const anchorWidth = width * 1.2
  const anchorDepth = depth * 1.1
  const start = (anchorWidth * riverSize - 2) * -0.5
  const offset = -3.2
  for (let column = 0; column < 3; column++) {
    for (let rank = 0; rank < riverSize; rank++) {
      anchors.push({
        id: `river-${wall}-${column + 1}-${rank + 1}`,
        kinds: [kinds.tile],
        x:
          start * invertX +
          (isHorizontal
            ? rank * anchorWidth
            : (column * -anchorDepth + offset) * invertX),
        z:
          start * invertZ +
          (isHorizontal
            ? (column * -anchorDepth + offset) * invertZ
            : -rank * anchorWidth),
        height,
        width: isHorizontal ? width : depth,
        depth: isHorizontal ? depth : width,
        angle,
        flip: false,
        snappedIds: []
      })
    }
  }
  return anchors
}

function buildScoreAnchor(
  /** @type {{ wallCount: number, invertX: number, invertZ: number, angle: number, isHorizontal: boolean }} */ {
    wallCount,
    invertX,
    invertZ,
    angle,
    isHorizontal
  }
) {
  const { height, width, depth } = shapes.score
  const { start, offset } = positions.score
  /** @type {import('@tabulous/types').Anchor} */
  return {
    id: `${ids.score}${wallCount}`,
    kinds: [
      kinds.sticks100,
      kinds.sticks1000,
      kinds.sticks5000,
      kinds.sticks10000
    ],
    x: start * invertX + (isHorizontal ? 0 : offset * -invertX),
    z: start * invertZ + (isHorizontal ? offset * -invertZ : 0),
    height,
    width: isHorizontal ? width : depth,
    depth: isHorizontal ? depth : width,
    angle,
    snappedIds: [],
    max:
      Object.values(stickQuantities).reduce(
        (total, quantity) => total + quantity
      ) * 4
  }
}
