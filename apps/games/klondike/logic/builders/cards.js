// @ts-check
/** @typedef {import('@tabulous/server/src/graphql').Mesh} Mesh */

import { counts, sizes, spacing, suits } from '../constants.js'

export function buildCards() {
  /** @type {Mesh[]} */
  const meshes = []
  for (const suit of suits) {
    for (let index = 1; index <= counts.suits; index++) {
      const id = `${suit}-${index}`
      meshes.push({
        shape: 'card',
        id,
        texture: `/assets/textures/${suit}-${index}.1.ktx2`,
        ...sizes.card,
        detailable: {
          frontImage: `/assets/images/${suit}-${index}.1.svg`
        },
        anchorable: {
          anchors: [
            { id: `${id}-bottom`, z: spacing.cardAnchor.z, ...sizes.card },
            { id: `${id}-top`, z: -spacing.cardAnchor.z, ...sizes.card }
          ]
        },
        movable: { kind: suit },
        stackable: { priority: 1 },
        flippable: {},
        rotable: {}
      })
    }
  }
  return meshes
}
