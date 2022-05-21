import { counts, sizes, spacing, suits } from '../constants.js'

export function buildCards() {
  const meshes = []
  for (const suit of suits) {
    for (let index = 1; index <= counts.suits; index++) {
      meshes.push({
        shape: 'card',
        id: `${suit}-${index}`,
        texture: `/games/french-suited-card/textures/${suit}-${index}.ktx2`,
        ...sizes.card,
        detailable: {
          frontImage: `/games/french-suited-card/images/${suit}-${index}.svg`,
          backImage: `/games/french-suited-card/images/back.svg`
        },
        anchorable: {
          anchors: [
            { id: 'bottom', z: spacing.cardAnchor.z, ...sizes.card },
            { id: 'top', z: -spacing.cardAnchor.z, ...sizes.card }
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
