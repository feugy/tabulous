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

const depth = 4.25
const width = 3
const height = 0.01

for (const suit of suits) {
  for (let index = 1; index <= 13; index++) {
    meshes.push({
      shape: 'card',
      id: `${suit}-${index}`,
      texture: `images/french-suited-cards/${suit}-${index}.ktx2`,
      x: 0,
      y: 0,
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
          { id: 'bottom', z: -1, width, height, depth },
          { id: 'top', z: 1, width, height, depth }
        ]
      },
      movable: { kind: suit },
      stackable: { priority: 1 },
      // use all defaults
      drawable: {},
      flippable: {},
      rotable: {}
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
  width: 30,
  height: 0.01,
  depth: 30,
  borderRadius: 0.4,
  anchorable: {
    anchors: [
      { id: 'stock', x: -12.25, z: 11.5, width, height, depth },
      { id: 'discard', x: -8.25, z: 11.5, width, height, depth },
      {
        id: 'diamonds',
        x: -0.25,
        z: 11.5,
        width,
        height,
        depth,
        kinds: ['diamonds']
      },
      { id: 'clubs', x: 3.75, z: 11.5, width, height, depth, kinds: ['clubs'] },
      {
        id: 'hearts',
        x: 7.75,
        z: 11.5,
        width,
        height,
        depth,
        kinds: ['hearts']
      },
      {
        id: 'spades',
        x: 11.75,
        z: 11.5,
        width,
        height,
        depth,
        kinds: ['spades']
      },
      { id: 'column-1', x: -12.25, z: 6.55, width, height, depth },
      { id: 'column-2', x: -8.25, z: 6.55, width, height, depth },
      { id: 'column-3', x: -4.25, z: 6.55, width, height, depth },
      { id: 'column-4', x: -0.25, z: 6.55, width, height, depth },
      { id: 'column-5', x: 3.75, z: 6.55, width, height, depth },
      { id: 'column-6', x: 7.75, z: 6.55, width, height, depth },
      { id: 'column-7', x: 11.75, z: 6.55, width, height, depth }
    ]
  }
})

const flipped = { flippable: { isFlipped: true } }
/**
 * Pre-define slots: 1 on first column, 2 on second column, and so on.
 * Remainings are on discard
 * @type {import('../src/services/utils').Slot[]}
 */
export const slots = [
  { bagId: 'cards', anchorId: 'column-1', count: 1 },
  { bagId: 'cards', anchorId: 'column-2', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-2.bottom', count: 1 },
  { bagId: 'cards', anchorId: 'column-3', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-3.bottom', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-3.bottom.bottom', count: 1 },
  { bagId: 'cards', anchorId: 'column-4', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-4.bottom', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-4.bottom.bottom', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-4.bottom.bottom.bottom', count: 1 },
  { bagId: 'cards', anchorId: 'column-5', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-5.bottom', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-5.bottom.bottom', count: 1, ...flipped },
  {
    bagId: 'cards',
    anchorId: 'column-5.bottom.bottom.bottom',
    count: 1,
    ...flipped
  },
  {
    bagId: 'cards',
    anchorId: 'column-5.bottom.bottom.bottom.bottom',
    count: 1
  },
  { bagId: 'cards', anchorId: 'column-6', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-6.bottom', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-6.bottom.bottom', count: 1, ...flipped },
  {
    bagId: 'cards',
    anchorId: 'column-6.bottom.bottom.bottom',
    count: 1,
    ...flipped
  },
  {
    bagId: 'cards',
    anchorId: 'column-6.bottom.bottom.bottom.bottom',
    count: 1,
    ...flipped
  },
  {
    bagId: 'cards',
    anchorId: 'column-6.bottom.bottom.bottom.bottom.bottom',
    count: 1
  },
  { bagId: 'cards', anchorId: 'column-7', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-7.bottom', count: 1, ...flipped },
  { bagId: 'cards', anchorId: 'column-7.bottom.bottom', count: 1, ...flipped },
  {
    bagId: 'cards',
    anchorId: 'column-7.bottom.bottom.bottom',
    count: 1,
    ...flipped
  },
  {
    bagId: 'cards',
    anchorId: 'column-7.bottom.bottom.bottom.bottom',
    count: 1,
    ...flipped
  },
  {
    bagId: 'cards',
    anchorId: 'column-7.bottom.bottom.bottom.bottom.bottom',
    count: 1,
    ...flipped
  },
  {
    bagId: 'cards',
    anchorId: 'column-7.bottom.bottom.bottom.bottom.bottom.bottom',
    count: 1
  },
  { bagId: 'cards', anchorId: 'stock', ...flipped }
]
