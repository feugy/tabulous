import { kinds, riverSize, shapes, walls, wallSize } from '../constants.js'

export function buildMainBoard() {
  const { east, south, west, north } = walls
  return {
    id: 'main-board',
    shape: 'card',
    texture: '#00000000',
    y: 0.01,
    anchorable: {
      anchors: [
        ...buildWallAnchors({ wall: north, isHorizontal: true, angle: 0 }),
        ...buildRiverAnchors({ wall: north, isHorizontal: true, angle: 0 }),
        ...buildWallAnchors({ wall: east, isHorizontal: false, angle: 0.5 }),
        ...buildRiverAnchors({ wall: east, isHorizontal: false, angle: 0.5 }),
        ...buildWallAnchors({ wall: south, isHorizontal: true, angle: 1 }),
        ...buildRiverAnchors({ wall: south, isHorizontal: true, angle: 1 }),
        ...buildWallAnchors({ wall: west, isHorizontal: false, angle: 1.5 }),
        ...buildRiverAnchors({ wall: west, isHorizontal: false, angle: 1.5 })
      ]
    }
  }
}

function buildWallAnchors({ wall, isHorizontal, angle }) {
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
      angle: Math.PI * angle
    })
  }
  return anchors
}

function buildRiverAnchors({ river, isHorizontal, angle }) {
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
        id: `river-${river}-${column + 1}-${rank + 1}`,
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
        angle: Math.PI * angle
      })
    }
  }
  return anchors
}
