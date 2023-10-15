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
  const { offset } = positions.score
  const invertX = playerRank === 3 ? 1 : -1
  const invertZ = playerRank === 0 ? -1 : 1
  const isHorizontal = playerRank % 2 === 0
  const { height, diameter } = shapes.stick
  const spacing = height + 1

  for (const [rank, [name, quantity]] of Object.entries(
    stickQuantities
  ).entries()) {
    const kind = kinds[/** @type {'sticks100'} */ (`sticks${name}`)]
    const id = `stick-${name}-${playerRank}`
    sticks.push({
      id,
      shape: 'roundToken',
      texture: `stick-${name}.ktx2`,
      diameter,
      height,
      x:
        offset * invertX +
        (isHorizontal ? offset - spacing * 1.5 + rank * spacing : 0),
      y: 0.15,
      z:
        offset * invertZ +
        (isHorizontal ? 0 : -offset + spacing * 1.5 - rank * spacing),
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
