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
 * +
 * 1 board for all cards
 * @type {import('../src/services/games').Mesh[]}
 */
export const meshes = []

const suits = ['spades', 'diamonds', 'clubs', 'hearts']
const reds = ['diamonds', 'hearts']
const blacks = ['spades', 'clubs']

const depth = 4.25
const width = 3
const height = 0.01
const baseY = 0.025

for (const suit of suits) {
  for (let index = 1; index <= 13; index++) {
    meshes.push({
      shape: 'card',
      id: `${suit}-${index}`,
      texture: `images/french-suited-cards/${suit}-${index}.ktx2`,
      x: 0,
      y: baseY,
      z: 0,
      width,
      height,
      depth,
      detailable: {
        frontImage: `images/french-suited-cards/HR/${suit}-${index}.svg`,
        backImage: `images/french-suited-cards/HR/back.svg`
      },
      anchorable: {
        anchors: [
          {
            z: -1,
            width,
            height,
            depth,
            kinds: reds.includes(suit) ? blacks : reds
          }
        ]
      },
      movable: {
        kind: suit
      },
      // use all defaults
      flippable: {},
      rotable: {},
      stackable: {}
    })
  }
}

const pickId = ({ id }) => id

/**
 * Bags to randomize:
 * - one for all remaining cards
 * @type {Map<string, string[]>}
 */
export const bags = new Map([['cards', meshes.map(pickId)]])

meshes.push({
  shape: 'roundedTile',
  id: 'board',
  texture: `images/klondike/board.ktx2`,
  x: -0.75,
  y: -0.005,
  z: 0,
  width: 30,
  height: 0.01,
  depth: 30,
  borderRadius: 0.4,
  anchorable: {
    anchors: [
      // stock
      { x: -12.25, z: 11.5, width, height, depth },
      // discard
      { x: -8.25, z: 11.5, width, height, depth },
      // diamonds
      { x: -0.25, z: 11.5, width, height, depth, kinds: ['diamonds'] },
      // clubs
      { x: 3.75, z: 11.5, width, height, depth, kinds: ['clubs'] },
      // hearts
      { x: 7.75, z: 11.5, width, height, depth, kinds: ['hearts'] },
      // spades
      { x: 11.75, z: 11.5, width, height, depth, kinds: ['spades'] },
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
})

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
  {
    x: -9,
    y: baseY,
    z: 6.55,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  { x: -9, y: baseY + height * 2, z: 5, bagId: 'cards', count: 1 },
  // 3rd column
  {
    x: -5,
    y: baseY,
    z: 6.55,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: -5,
    y: baseY + height * 2,
    z: 5,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  { x: -5, y: baseY + height * 3, z: 3.75, bagId: 'cards', count: 1 },
  // 4th column
  {
    x: -1,
    y: baseY,
    z: 6.55,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: -1,
    y: baseY + height * 2,
    z: 5,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: -1,
    y: baseY + height * 3,
    z: 3.75,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  { x: -1, y: baseY + height * 4, z: 2.5, bagId: 'cards', count: 1 },
  // 5th column
  {
    x: 3,
    y: baseY,
    z: 6.55,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 3,
    y: baseY + height * 2,
    z: 5,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 3,
    y: baseY + height * 3,
    z: 3.75,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 3,
    y: baseY + height * 4,
    z: 2.5,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  { x: 3, y: baseY + height * 5, z: 1.25, bagId: 'cards', count: 1 },
  // 6th column
  {
    x: 7,
    y: baseY,
    z: 6.55,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 7,
    y: baseY + height * 2,
    z: 5,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 7,
    y: baseY + height * 3,
    z: 3.75,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 7,
    y: baseY + height * 4,
    z: 2.5,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 7,
    y: baseY + height * 5,
    z: 1.25,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  { x: 7, y: baseY + height * 6, z: 0, bagId: 'cards', count: 1 },
  // 7th column
  {
    x: 11,
    y: baseY,
    z: 6.55,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 11,
    y: baseY + height * 2,
    z: 5,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 11,
    y: baseY + height * 3,
    z: 3.75,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 11,
    y: baseY + height * 4,
    z: 2.5,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 11,
    y: baseY + height * 5,
    z: 1.25,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  {
    x: 11,
    y: baseY + height * 6,
    z: 0,
    bagId: 'cards',
    flippable: { isFlipped: true },
    count: 1
  },
  { x: 11, y: baseY + height * 8, z: -1.25, bagId: 'cards', count: 1 },
  // stock
  { x: -13, y: baseY, z: 11.5, bagId: 'cards', flippable: { isFlipped: true } }
]
