/**
 * Splendor's rules book has 4 pages.
 */
export const rulesBookPageCount = 4

/**
 * Minimum time in minutes.
 */
export const minTime = 30

/**
 * Minimum age in years.
 */
export const minAge = 10

/**
 * 40 level 1 cards, 30 level 2 cards, 20 level 3 cards.
 * +
 * 8 emeralds, rubies, quartzes, sapphires and diamonds round tokens.
 * 5 gold round tokens.
 * +
 * 10 noble rounded tiles.
 *
 * @type {import('../src/services/games').Mesh[]}
 */
export const meshes = []

const gems = ['diamond', 'emerald', 'quartz', 'ruby', 'sapphire']
const cardCountPerLevel = new Map([
  [1, 8],
  [2, 6],
  [3, 4]
])
const cardBags = { 1: [], 2: [], 3: [] }
const tokenBags = {
  diamond: [],
  emerald: [],
  quartz: [],
  ruby: [],
  sapphire: [],
  gold: []
}
const tileBag = []

/**
 * Bags to randomize:
 * - one for each card level
 * - one for each token type
 * - one for tiles
 * @type {Map<string, string[]>}
 */
export const bags = new Map([
  ['cards-level-1', cardBags[1]],
  ['cards-level-2', cardBags[2]],
  ['cards-level-3', cardBags[3]],
  ...gems.map(kind => [`tokens-${kind}`, tokenBags[kind]]),
  ['tokens-gold', tokenBags.gold],
  ['tiles', tileBag]
])

// 3 levels of cards.
// level 1 has 8 cards of each gem, level 2 has 6 cards of each, level 3 has 4 of each.
for (const [level, count] of cardCountPerLevel) {
  for (const kind of gems) {
    for (let index = 1; index <= count; index++) {
      const id = `card-${kind}-${level}-${index}`
      meshes.push({
        shape: 'card',
        id,
        texture: `images/splendor/${level}/${kind}-${index}.ktx2`,
        x: 0,
        z: 0,
        y: 0,
        width: 3,
        height: 0.01,
        depth: 4.25,
        detailable: {
          frontImage: `images/splendor/HR/card-${kind}-${level}-${index}.png`,
          backImage: `images/splendor/HR/card-${level}-back.png`
        },
        movable: { kind: 'card' },
        flippable: {},
        rotable: {},
        stackable: { kinds: ['card'] }
      })
      cardBags[level].push(id)
    }
  }
}

// 8 tokens of each gem, plus 5 gold
for (const kind of [...gems, 'gold']) {
  const count = kind === 'gold' ? 5 : 8
  for (let index = 1; index <= count; index++) {
    const id = `token-${kind}-${index}`
    meshes.push({
      shape: 'roundToken',
      id,
      texture: `images/splendor/tokens/${kind}.ktx2`,
      faceUV: [
        [0, 0, 0.49, 1],
        [0.49, 0, 0.509, 1],
        [0.509, 0, 1, 1]
      ],
      x: 0,
      y: 0.05,
      z: 0,
      diameter: 2,
      height: 0.1,
      detailable: {
        frontImage: `images/splendor/HR/token-${kind}.png`,
        backImage: `images/splendor/HR/token-${kind}.png`
      },
      movable: { kind: 'token' },
      flippable: {},
      rotable: {},
      stackable: { kinds: ['token'], extent: 0.9 }
    })
    tokenBags[kind].push(id)
  }
}

// 10 tiles
for (let index = 1; index <= 10; index++) {
  const id = `tile-${index}`
  meshes.push({
    shape: 'roundedTile',
    id,
    texture: `images/splendor/tiles/tile-${index}.ktx2`,
    faceUV: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0.5, 1, 0, 0],
      [0.5, 0, 1, 1]
    ],
    x: 0,
    z: 0,
    y: 0,
    width: 3,
    height: 0.05,
    depth: 3,
    borderRadius: 0.4,
    detailable: {
      frontImage: `images/splendor/HR/tile-${index}.png`,
      backImage: `images/splendor/HR/tile-back.png`
    },
    movable: { kind: 'tile' },
    flippable: {},
    rotable: {},
    stackable: { kinds: ['tile'] }
  })
  tileBag.push(id)
}

/**
 * Pre-define slots:
 * - tiles deck
 * - for each card level, one deck and 4 un-flipped cards
 * - one for each token type
 * @type {import('../src/services/utils').Slot[]}
 */
export const slots = [
  { x: -8, z: 11.5, bagId: 'tiles', flippable: { isFlipped: true } },
  { x: 8, z: 7, bagId: 'cards-level-3', count: 1 },
  { x: 4, z: 7, bagId: 'cards-level-3', count: 1 },
  { x: 0, z: 7, bagId: 'cards-level-3', count: 1 },
  { x: -4, z: 7, bagId: 'cards-level-3', count: 1 },
  { x: -8, z: 7, bagId: 'cards-level-3', flippable: { isFlipped: true } },
  { x: 8, z: 2, bagId: 'cards-level-2', count: 1 },
  { x: 4, z: 2, bagId: 'cards-level-2', count: 1 },
  { x: 0, z: 2, bagId: 'cards-level-2', count: 1 },
  { x: -4, z: 2, bagId: 'cards-level-2', count: 1 },
  { x: -8, z: 2, bagId: 'cards-level-2', flippable: { isFlipped: true } },
  { x: 8, z: -3, bagId: 'cards-level-1', count: 1 },
  { x: 4, z: -3, bagId: 'cards-level-1', count: 1 },
  { x: 0, z: -3, bagId: 'cards-level-1', count: 1 },
  { x: -4, z: -3, bagId: 'cards-level-1', count: 1 },
  { x: -8, z: -3, bagId: 'cards-level-1', flippable: { isFlipped: true } },
  { x: -7, z: -7, bagId: 'tokens-gold' },
  { x: -4, z: -7, bagId: 'tokens-emerald' },
  { x: -1, z: -7, bagId: 'tokens-sapphire' },
  { x: 2, z: -7, bagId: 'tokens-diamond' },
  { x: 5, z: -7, bagId: 'tokens-quartz' },
  { x: 8, z: -7, bagId: 'tokens-ruby' }
]
