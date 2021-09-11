/**
 * Minimum time in minutes.
 */
export const minTime = 15

/**
 * Minimum age in years.
 */
export const minAge = 7

/**
 * 13 cards of each suit: spades, diamonds, clubs, hearts.
 * @type {import('../src/services/games').Card[]}
 */
export const cards = []

const suits = ['spades', 'diamonds', 'clubs', 'hearts']

const depth = 0.01
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
      y: 0.1,
      width: 3,
      height: 4.25,
      depth
    })
  }
}

const pickId = ({ id }) => id

/**
 * 1 board for all cards
 * @type {import('../src/services/games').Board[]}
 */
export const boards = [
  {
    id: 'board',
    texture: `images/klondike/board.ktx2`,
    x: -0.75, // 14.25
    y: 0,
    z: 0, // 12.875
    width: 30,
    height: 30,
    depth: 0.01,
    borderRadius: 0.4
  }
]

/**
 * Bags to randomize:
 * - one for all remaining cards
 * @type {Map<string, string[]>}
 */
export const bags = new Map([['cards', cards.map(pickId)]])

const baseY = 0.02

/**
 * Pre-define slots:
 * - tiles deck
 * - for each card level, one deck and 4 un-flipped cards
 * - one for each token type
 * @type {import('../src/services/utils').Slot[]}
 */
export const slots = [
  // 1st column x: 1.25, z: 6.325, width: 3, height: 4.25
  { x: -13, y: baseY, z: 6.55, bagId: 'cards', count: 1 },
  // 2nd column x: 5.25, z: 6.325, width: 3, height: 4.25
  { x: -9, y: baseY, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  { x: -9, y: baseY + depth * 2, z: 5, bagId: 'cards', count: 1 },
  // 3rd column x: 9.25, z: 6.325, width: 3, height: 4.25
  { x: -5, y: baseY, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  {
    x: -5,
    y: baseY + depth * 2,
    z: 5,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  { x: -5, y: baseY + depth * 3, z: 3.75, bagId: 'cards', count: 1 },
  // 4th column x: 13.25, z: 6.325, width: 3, height: 4.25
  { x: -1, y: baseY, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  {
    x: -1,
    y: baseY + depth * 2,
    z: 5,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  {
    x: -1,
    y: baseY + depth * 3,
    z: 3.75,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  { x: -1, y: baseY + depth * 4, z: 2.5, bagId: 'cards', count: 1 },
  // 5th column x: 17.25, z: 6.325, width: 3, height: 4.25
  { x: 3, y: baseY, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  {
    x: 3,
    y: baseY + depth * 2,
    z: 5,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  {
    x: 3,
    y: baseY + depth * 3,
    z: 3.75,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  {
    x: 3,
    y: baseY + depth * 4,
    z: 2.5,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  { x: 3, y: baseY + depth * 5, z: 1.25, bagId: 'cards', count: 1 },
  // 6th column x: 21.25, z: 6.325, width: 3, height: 4.25
  { x: 7, y: baseY, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  {
    x: 7,
    y: baseY + depth * 2,
    z: 5,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  {
    x: 7,
    y: baseY + depth * 3,
    z: 3.75,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  {
    x: 7,
    y: baseY + depth * 4,
    z: 2.5,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  {
    x: 7,
    y: baseY + depth * 5,
    z: 1.25,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  { x: 7, y: baseY + depth * 6, z: 0, bagId: 'cards', count: 1 },
  // 7th column x: 25.25, z: 6.325, width: 3, height: 4.25
  { x: 11, y: baseY, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  {
    x: 11,
    y: baseY + depth * 2,
    z: 5,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  {
    x: 11,
    y: baseY + depth * 3,
    z: 3.75,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  {
    x: 11,
    y: baseY + depth * 4,
    z: 2.5,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  {
    x: 11,
    y: baseY + depth * 5,
    z: 1.25,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  {
    x: 11,
    y: baseY + depth * 6,
    z: 0,
    bagId: 'cards',
    isFlipped: true,
    count: 1
  },
  { x: 11, y: baseY + depth * 8, z: -1.25, bagId: 'cards', count: 1 },
  // remaining cards x: 1.25, z: 1.375, width: 3, height: 4.25
  { x: -13, y: baseY, z: 11.5, bagId: 'cards', isFlipped: true }
  // trash: x: 5.25, z: 1.375, width: 3, height: 4.25
  // diamonds: x: 13.25, z: 1.375, width: 3, height: 4.25
  // clubs: x: 17.25, z: 1.375, width: 3, height: 4.25
  // spades: x: 21.25, z: 1.375, width: 3, height: 4.25
  // hearts: x: 25.25, z: 1.375, width: 3, height: 4.25
]
