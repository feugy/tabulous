export function build() {
  /**
   * 8 cards of each suit: spades, diamonds, clubs, hearts.
   * @type {import('@tabulous/server/src/services/games').Mesh[]}
   */
  const meshes = []

  const suits = ['spades', 'diamonds', 'clubs', 'hearts']

  const depth = 4.25
  const width = 3
  const height = 0.01

  for (const suit of suits) {
    for (let index = 1; index <= 13; index++) {
      if (index === 1 || index >= 7) {
        meshes.push({
          shape: 'card',
          id: `${suit}-${index}`,
          texture: `/games/french-suited-card/textures/${suit}-${index}.ktx2`,
          x: 0,
          y: 0,
          z: 0,
          width,
          height,
          depth,
          // use all defaults
          movable: {},
          stackable: {},
          drawable: {},
          flippable: { isFlipped: true },
          rotable: {}
        })
      }
    }
  }

  /**
   * Bags to randomize: one for all cards
   * @type {Map<string, string[]>}
   */
  const bags = new Map([['cards', meshes.map(({ id }) => id)]])

  /**
   * Pre-defined slots: one for all cards
   * @type {import('@tabulous/server/src/services/utils').Slot[]}
   */
  const slots = [{ bagId: 'cards' }]

  return { meshes, bags, slots }
}
