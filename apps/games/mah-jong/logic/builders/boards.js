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
  const { east, south, west, north } = walls
  return {
    id: 'main-board',
    shape: 'card',
    texture: '#00000000',
    y: 0.01,
    anchorable: {
      anchors: [
        ...buildPlayerAnchors({
          wall: north,
          isHorizontal: true,
          angle: 0,
          rank: 2
        }),
        ...buildPlayerAnchors({
          wall: east,
          isHorizontal: false,
          angle: 0.5,
          rank: 3
        }),
        ...buildPlayerAnchors({
          wall: south,
          isHorizontal: true,
          angle: 1,
          rank: 0
        }),
        ...buildPlayerAnchors({
          wall: west,
          isHorizontal: false,
          angle: 1.5,
          rank: 1
        })
      ]
    }
  }
}

function buildPlayerAnchors(
  /** @type {{ wall: import('../constants').Wall, isHorizontal: boolean, angle: number, rank: number }} */ {
    wall,
    isHorizontal,
    angle,
    rank
  }
) {
  return [
    ...buildWallAnchors({ wall, isHorizontal, angle }),
    ...buildRiverAnchors({ wall, isHorizontal, angle }),
    buildScoreAnchor({ rank, isHorizontal, angle })
  ]
}

function buildWallAnchors(
  /** @type {{ wall: import('../constants').Wall, isHorizontal: boolean, angle: number }} */ {
    wall,
    isHorizontal,
    angle
  }
) {
  /** @type {import('@tabulous/types').Anchor[]} */
  const anchors = []
  const { width, height, depth } = shapes.anchor
  const start = (width * wallSize - 2) * -0.5
  const offset = 0 // (isHorizontal && angle === 1) || angle === 0.5 ? -3.5 : 3.5
  const gap = depth
  const invertX = angle === 0.5 ? -1 : 1
  const invertZ = angle === 1 ? 1 : -1
  for (let rank = 0; rank < wallSize; rank++) {
    anchors.push({
      id: `${wall}-${rank + 1}`,
      kinds: [kinds.tile],
      x:
        start * invertX +
        (isHorizontal ? rank * width + offset : gap * -invertX),
      z:
        start * invertZ +
        (isHorizontal ? gap * -invertZ : -rank * width + offset),
      height,
      width: isHorizontal ? width : depth,
      depth: isHorizontal ? depth : width,
      angle: Math.PI * angle,
      snappedIds: []
    })
  }
  return anchors
}

function buildRiverAnchors(
  /** @type {{ wall: import('../constants').Wall, isHorizontal: boolean, angle: number }} */ {
    wall,
    isHorizontal,
    angle
  }
) {
  /** @type {import('@tabulous/types').Anchor[]} */
  const anchors = []
  const { width, height, depth } = shapes.anchor
  const anchorWidth = width * 1.2
  const anchorDepth = depth * 1.1
  const start = (anchorWidth * riverSize - 2) * -0.5
  const offset = -3.2
  const invertX = angle === 0.5 ? -1 : 1
  const invertZ = angle === 1 ? 1 : -1
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
        angle: Math.PI * angle,
        snappedIds: []
      })
    }
  }
  return anchors
}

function buildScoreAnchor(
  /** @type {{ rank: number, isHorizontal: boolean, angle: number }} */ {
    rank,
    isHorizontal,
    angle
  }
) {
  const { height, width, depth } = shapes.score
  const invertX = angle === 0.5 ? -1 : 1
  const invertZ = angle === 1 ? -1 : 1
  const { start, offset } = positions.score
  /** @type {import('@tabulous/types').Anchor} */
  return {
    id: `${ids.score}${rank}`,
    kinds: [
      kinds.sticks100,
      kinds.sticks1000,
      kinds.sticks5000,
      kinds.sticks10000
    ],
    x: start * invertX + (isHorizontal ? 0 : offset * invertX),
    z: start * invertZ + (isHorizontal ? offset * invertZ : 0),
    height,
    width: isHorizontal ? width : depth,
    depth: isHorizontal ? depth : width,
    angle: Math.PI * angle,
    snappedIds: [],
    max:
      Object.values(stickQuantities).reduce(
        (total, quantity) => total + quantity
      ) * 4
  }
}
