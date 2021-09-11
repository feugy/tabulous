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
const width = 3
const height = 4.25
const baseY = 0.025

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
      y: baseY,
      z: 0,
      width,
      height,
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
    x: -0.75,
    y: -0.005,
    z: 0,
    width: 30,
    height: 30,
    depth: 0.01,
    borderRadius: 0.4,
    anchors: [
      // stock
      { x: -12.25, z: 11.5, width, height, depth },
      // discard
      { x: -8.25, z: 11.5, width, height, depth },
      // diamonds
      { x: -0.25, z: 11.5, width, height, depth },
      // clubs
      { x: 3.75, z: 11.5, width, height, depth },
      // spades
      { x: 7.75, z: 11.5, width, height, depth },
      // hearts
      { x: 11.75, z: 11.5, width, height, depth },
      // 7 columns
      { x: -12.25, z: 6.55, width, height, depth },
      { x: -8.25, z: 6.55, width, height, depth },
      { x: -4.25, z: 6.55, width, height, depth },
      { x: -0.25, z: 6.55, width, height, depth },
      { x: 3.75, z: 6.55, width, height, depth },
      { x: 7.75, z: 6.55, width, height, depth },
      { x: 11.75, z: 6.55, width, height, depth }
    ]
  }
]

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
  { x: -13, y: baseY, z: 6.55, bagId: 'cards', count: 1 },
  // 2nd column
  { x: -9, y: baseY, z: 6.55, bagId: 'cards', isFlipped: true, count: 1 },
  { x: -9, y: baseY + depth * 2, z: 5, bagId: 'cards', count: 1 },
  // 3rd column
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
  // 4th column
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
  // 5th column
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
  // 6th column
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
  // 7th column
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
  // stock
  { x: -13, y: baseY, z: 11.5, bagId: 'cards', isFlipped: true }
]
