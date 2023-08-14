// @ts-check
/** @typedef {import('@tabulous/server/src/graphql').Mesh} Mesh */

import { stackMeshes } from '@tabulous/server/src/utils/index.js'

const sizes = {
  card: { depth: 4.25, width: 3, height: 0.01 },
  die: { diameter: 1 }
}
const spacing = {
  cardAnchor: { z: -1 }
}

export function buildCards(full = false) {
  /** @type {Mesh[]} */
  const cards = []
  for (const suit of ['spades', 'diamonds', 'clubs', 'hearts']) {
    for (let index = 1; index <= 13; index++) {
      if (full || index === 1 || index >= 7) {
        const id = `${suit}-${index}`
        cards.push({
          shape: 'card',
          id,
          texture: `/assets/textures/${suit}-${index}.1.ktx2`,
          ...sizes.card,
          detailable: {
            frontImage: `/assets/images/${suit}-${index}.1.svg`,
            backImage: `/assets/images/french-suited-card-back.1.svg`
          },
          anchorable: {
            anchors: [
              { id: `${id}-bottom`, z: spacing.cardAnchor.z, ...sizes.card },
              { id: `${id}-top`, z: -spacing.cardAnchor.z, ...sizes.card }
            ]
          },
          flippable: { isFlipped: true },
          movable: { kind: 'card' },
          stackable: { kinds: ['card'], priority: 1 },
          drawable: {},
          rotable: {}
        })
      }
    }
  }
  stackMeshes(cards)
  return cards
}

export function buildDice(
  /** @type {number} */ faces,
  /** @type {number} */ count,
  offset = 0
) {
  /** @type {Mesh[]} */
  const dices = []
  for (let rank = 1; rank <= count; rank++) {
    dices.push({
      shape: 'die',
      id: `d${faces}-${rank}`,
      faces,
      texture: `/assets/textures/die-${faces}.1.ktx2`,
      ...sizes.die,
      x: (rank - 1) * 3,
      z: -3 + offset,
      movable: {},
      drawable: {},
      randomizable: { canBeSet: true }
    })
  }
  return dices
}
