export const suits = ['diamonds', 'clubs', 'hearts', 'spades']

export const sizes = {
  board: { width: 30, height: 0.01, depth: 30 },
  card: { depth: 4.25, width: 3, height: 0.01 }
}

export const positions = {
  board: { x: -0.75, y: -0.005 },
  column: { x: -12.25, z: 6.55 },
  discard: { x: -8.25, z: 11.5 },
  goal: { x: -0.25, z: 11.5 },
  reserve: { x: -12.25, z: 11.5 }
}

export const spacing = {
  cardAnchor: { z: -1 },
  column: { x: 4 }
}

export const counts = {
  columns: 7,
  suits: 13
}

export const anchorIds = {
  column: 'column',
  reserve: 'reserve'
}

export const faceUVs = {
  board: [
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ]
}
