/**
 * 13 cards of each suit: spades, diamonds, clubs, hearts.
 * @type {import('../src/services/games').Card[]}
 */
export const cards = []

const suits = ['spades', 'diamonds', 'clubs', 'hearts']

for (const suit of suits) {
  for (let index = 1; index <= 13; index++) {
    cards.push({
      id: `${suit}-${index}`,
      texture: `images/french-suited-cards/${suit}-${index}.ktx2`,
      images: {
        front: `images/french-suited-cards/HR/${suit}-${index}.svg`,
        back: `images/french-suited-cards/HR/back.svg`
      },
      x: 0,
      z: 0,
      y: 0,
      width: 3,
      height: 4.25,
      depth: 0.01
    })
  }
}

const pickId = ({ id }) => id

/**
 * Bags to randomize:
 * - one for all remaining cards
 * @type {Map<string, string[]>}
 */
export const bags = new Map([['cards', cards.map(pickId)]])

/**
 * Pre-define slots:
 * - tiles deck
 * - for each card level, one deck and 4 un-flipped cards
 * - one for each token type
 * @type {import('../src/services/utils').Slot[]}
 */
export const slots = [
  // 1st column
  { x: -13, z: 6.55, bagId: 'cards', count: 1 },
  // 2nd column
  { x: -9, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  { x: -9, z: 5, y: 0.02, bagId: 'cards', count: 1 },
  // 3rd colum3
  { x: -5, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  { x: -5, z: 5, y: 0.02, bagId: 'cards', isFlipped: true, count: 1 },
  { x: -5, z: 3.75, y: 0.03, bagId: 'cards', count: 1 },
  // 4th column
  { x: -1, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  { x: -1, z: 5, y: 0.02, bagId: 'cards', isFlipped: true, count: 1 },
  { x: -1, z: 3.75, y: 0.03, bagId: 'cards', isFlipped: true, count: 1 },
  { x: -1, z: 2.5, y: 0.04, bagId: 'cards', count: 1 },
  // 5th column
  { x: 3, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 3, z: 5, y: 0.02, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 3, z: 3.75, y: 0.03, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 3, z: 2.5, y: 0.04, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 3, z: 1.25, y: 0.05, bagId: 'cards', count: 1 },
  // 6th column
  { x: 7, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 7, z: 5, y: 0.02, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 7, z: 3.75, y: 0.03, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 7, z: 2.5, y: 0.04, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 7, z: 1.25, y: 0.05, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 7, z: 0, y: 0.06, bagId: 'cards', count: 1 },
  // 7th column
  { x: 11, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 11, z: 5, y: 0.02, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 11, z: 3.75, y: 0.03, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 11, z: 2.5, y: 0.04, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 11, z: 1.25, y: 0.05, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 11, z: 0, y: 0.06, bagId: 'cards', isFlipped: true, count: 1 },
  { x: 11, z: -1.25, y: 0.07, bagId: 'cards', count: 1 },
  // remaining cards
  { x: -13, z: 11, bagId: 'cards', isFlipped: true }
]
