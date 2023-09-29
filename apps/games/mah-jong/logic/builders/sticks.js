// @ts-check
import { kinds } from '../constants.js'

export function buildSticks(/** @type {number} */ playerRank) {
  /** @type {import('@tabulous/types').Mesh[]} */
  const sticks = []
  const { x, z, angle, offset } =
    playerRank === 0
      ? { x: 0, z: -27, angle: 0, offset: -1 }
      : playerRank === 1
      ? { x: -27, z: 0, angle: Math.PI * 0.5, offset: -1 }
      : playerRank === 2
      ? { x: 0, z: 27, angle: 0, offset: 1 }
      : { x: 27, z: 0, angle: Math.PI * 0.5, offset: 1 }
  for (const [rank, { name, quantity }] of [
    { name: 100, quantity: 10 },
    { name: 1000, quantity: 4 },
    { name: 5000, quantity: 2 },
    { name: 10000, quantity: 1 }
  ].entries()) {
    const kind = kinds[/** @type {'sticks100'} */ (`sticks${name}`)]
    sticks.push({
      id: `stick-${name}-${playerRank}`,
      shape: 'roundToken',
      texture: `stick-${name}.ktx2`,
      diameter: 0.3,
      height: 7,
      x: x + (angle ? rank * offset : 0),
      y: 0.15,
      z: z + (angle ? 0 : rank * offset),
      faceUV: [
        [0, 0, 0, 0],
        [1, 0, 0, 1],
        [0, 0, 0, 0]
      ],
      transform: { roll: Math.PI * 0.5, scaleZ: 2 },
      movable: { kind },
      quantifiable: { quantity, kinds: [kind] },
      flippable: {},
      rotable: { angle }
    })
  }
  return sticks
}
