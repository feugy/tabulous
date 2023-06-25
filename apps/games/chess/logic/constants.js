export const whiteId = 'white'
export const blackId = 'black'

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
