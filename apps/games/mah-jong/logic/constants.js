export const walls = {
  east: 'east',
  south: 'south',
  west: 'west',
  north: 'north'
}

export const wallSize = 17

export const riverSize = 6

export const kinds = {
  tile: 'tile',
  sticks100: 'sticks-100',
  sticks1000: 'sticks-1000',
  sticks5000: 'sticks-5000',
  sticks10000: 'sticks-10000'
}

export const shapes = {
  // Size 6: https://en.wikipedia.org/wiki/Mahjong_tiles#Construction
  tile: { width: 2.4, height: 1.9, depth: 3.6, borderRadius: 0.55 },
  anchor: { width: 2.5, height: 0.1, depth: 3.75 },
  dealerMark: { width: 5, depth: 2.5, height: 0.3 }
}

export const faceUVs = {
  tile: [
    [0.5, 1, 0.75, 0],
    [0.5, 1, 0.75, 0],
    [0.5, 1, 0.75, 0],
    [0.5, 1, 0.75, 0],
    [0.5, 1, 0, 0],
    [0.75, 0, 1, 1]
  ]
}

export const maxTilePByKind = new Map([
  ['man', 9],
  ['pei', 9],
  ['sou', 9],
  ['wind', 4],
  ['dragon', 3]
])
