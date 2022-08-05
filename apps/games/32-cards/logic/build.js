const bagId = 'cards'
const suits = ['spades', 'diamonds', 'clubs', 'hearts']
const sizes = { card: { depth: 4.25, width: 3, height: 0.01 } }
const counts = { suit: 13 }

export function build() {
  /**
   * 8 cards of each suit: spades, diamonds, clubs, hearts.
   * @type {import('@tabulous/server/src/services/games').Mesh[]}
   */
  const meshes = buildCards()

  /**
   * Bags to randomize: one for all cards
   * @type {Map<string, string[]>}
   */
  const bags = new Map([[bagId, meshes.map(({ id }) => id)]])

  /**
   * Pre-defined slots: one for all cards
   * @type {import('@tabulous/server/src/services/utils').Slot[]}
   */
  const slots = [{ bagId }]

  return { meshes, bags, slots }
}

function buildCards() {
  const meshes = []
  for (const suit of suits) {
    for (let index = 1; index <= counts.suit; index++) {
      if (index === 1 || index >= 7) {
        meshes.push({
          shape: 'card',
          id: `${suit}-${index}`,
          texture: `/french-suited-card/textures/${suit}-${index}.ktx2`,
          ...sizes.card,
          flippable: { isFlipped: true },
          movable: {},
          stackable: {},
          drawable: {},
          rotable: {}
        })
      }
    }
  }
  return meshes
}
