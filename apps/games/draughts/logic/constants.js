export const counts = { pawns: 20, columns: 10 }

export const blackId = 'black'

export const whiteId = 'white'

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
