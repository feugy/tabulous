// @ts-check
/** @typedef {import("@tabulous/server/src/utils").CameraPosition} CameraPosition*/

/** @typedef {'white'|'black'} Side */

export const counts = { pawns: 20, columns: 10 }

/** @type {Side} */
export const blackId = 'black'

/** @type {Side} */
export const whiteId = 'white'

/** @type {Record<Side, string>} */
export const colors = {
  [blackId]: '#633b21ff',
  [whiteId]: '#e4e1dfff'
}

export const sizes = {
  board: { depth: 30, width: 30, height: 0.5, borderRadius: 0.8 },
  pawn: { diameter: 2.9, height: 0.5 }
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
