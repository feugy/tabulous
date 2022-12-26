export const white = 'white'
export const black = 'black'

export const colors = {
  [white]: '#efd3c0ff',
  [black]: '#603b23ff'
}

export const sizes = {
  board: { depth: 3 * 8, width: 3 * 8, height: 0.5, borderRadius: 0.8 },
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
