// @ts-check
/**
 * @typedef {import("@tabulous/server/src/utils").CameraPosition} CameraPosition
 */

/** @typedef {'white'|'black'} Side */

/** @type {Side} */
export const whiteId = 'white'
/** @type {Side} */
export const blackId = 'black'

/** @type {Record<Side, string>} */
export const colors = {
  [whiteId]: '#efd3c0ff',
  [blackId]: '#603b23ff'
}

export const sizes = {
  board: { depth: 3 * 9, width: 3 * 9, height: 0.5, borderRadius: 0.8 },
  tile: 3
}

export const faceUVs = {
  board: [
    [0.1, 0.1, 0, 0],
    [0.1, 0.1, 0, 0],
    [0.1, 0.1, 0, 0],
    [0.1, 0.1, 0, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0]
  ]
}

export const pieces = [
  'rook-1',
  'knight-1',
  'bishop-1',
  'queen',
  'king',
  'bishop-2',
  'knight-2',
  'rook-2'
]

/** @type {Record<Side, Partial<CameraPosition>>} */
export const cameraPositions = {
  [blackId]: {
    alpha: Math.PI / 2,
    target: [0, 0, 2],
    elevation: 37
  },
  [whiteId]: {
    target: [0, 0, -2],
    elevation: 37
  }
}
