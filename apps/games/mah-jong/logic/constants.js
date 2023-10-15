// @ts-check

// https://coolors.co/b36b00-cb0a2a-adc2ad-1e152a-9c9c9c-eea93f-2274a5
export const colors = {
  base: '#b36b00',
  primary: '#cb0a2a',
  secondary: '#adc2ad',
  players: ['#cb0a2a', '#1e152a', '#9c9c9c', '#eea93f', '#2274a5']
}

/** @typedef {'east'|'south'|'west'|'north'} Wall */

/**
 * Order matters here! esast goes for first player, then we rotates clockwise.
 * @type {Record<Wall, Wall>}
 */
export const walls = {
  east: 'east',
  south: 'south',
  west: 'west',
  north: 'north'
}

export const wallSize = 17

export const riverSize = 6

export const ids = {
  stick: 'sticks-',
  score: 'score-'
}

export const kinds = {
  tile: 'tile',
  sticks100: `${ids.stick}100`,
  sticks1000: `${ids.stick}1000`,
  sticks5000: `${ids.stick}5000`,
  sticks10000: `${ids.stick}10000`
}

export const stickQuantities = {
  100: 10,
  1000: 4,
  5000: 2,
  10000: 1
}

export const shapes = {
  // Size 6: https://en.wikipedia.org/wiki/Mahjong_tiles#Construction
  tile: { width: 2.4, height: 1.9, depth: 3.6, borderRadius: 0.55 },
  anchor: { width: 2.5, height: 0.1, depth: 3.75 },
  dealerMark: { width: 5, height: 0.3, depth: 2.5 },
  stick: { diameter: 0.3, height: 7 },
  score: { width: 40, height: 0.1, depth: 8 }
}

export const positions = {
  score: { start: 0, offset: 32 }
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
