// @ts-check
import { findAnchor } from '@tabulous/game-utils'

import { ids, kinds, positions, shapes, stickQuantities } from '../constants.js'

export function buildSticks(
  /** @type {number} */ playerRank,
  /** @type {import('@tabulous/types').Mesh[]} */ meshes
) {
  /** @type {import('@tabulous/types').Mesh[]} */
  const sticks = []
  const anchor = findAnchor(`${ids.score}${playerRank}`, meshes)
  const start = 3
  const { x, z, angle, offset } =
    playerRank === 0
      ? {
          x: positions.score.start,
          z: -positions.score.offset + start,
          angle: 0,
          offset: -1
        }
      : playerRank === 1
      ? {
          x: -positions.score.offset + start,
          z: positions.score.start,
          angle: Math.PI * 0.5,
          offset: -1
        }
      : playerRank === 2
      ? {
          x: positions.score.start,
          z: positions.score.offset - start,
          angle: 0,
          offset: 1
        }
      : {
          x: positions.score.offset - start,
          z: positions.score.start,
          angle: Math.PI * 0.5,
          offset: 1
        }
  for (const [rank, [name, quantity]] of Object.entries(
    stickQuantities
  ).entries()) {
    const kind = kinds[/** @type {'sticks100'} */ (`sticks${name}`)]
    const id = `stick-${name}-${playerRank}`
    sticks.push({
      id,
      shape: 'roundToken',
      texture: `stick-${name}.ktx2`,
      ...shapes.stick,
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
      quantifiable: { quantity: +quantity, kinds: [kind] },
      flippable: {},
      rotable: {}
    })
    anchor.snappedIds.push(id)
  }
  return sticks
}
