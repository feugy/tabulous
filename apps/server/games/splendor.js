export const cards = []
export const roundTokens = []
export const roundedTiles = []

const gems = ['diamond', 'emerald', 'quartz', 'ruby', 'sapphire']
const cardCountPerLevel = new Map([
  [1, 8],
  [2, 6],
  [3, 4]
])
// 3 levels of cards.
// level 1 has 8 cards of each gem, level 2 has 6 cards of each, level 3 has 4 of each.
for (const [level, count] of cardCountPerLevel) {
  for (const kind of gems) {
    for (let index = 1; index <= count; index++) {
      cards.push({
        id: `card-${kind}-${level}-${index}`,
        texture: `images/splendor/${level}/${kind}-${index}.ktx2`,
        images: {
          front: `images/splendor/HR/card-${kind}-${level}-${index}.png`,
          back: `images/splendor/HR/card-${level}-back.png`
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
}

// 8 tokens of each gem, plus 5 gold
for (const kind of [...gems, 'gold']) {
  const count = kind === 'gold' ? 5 : 8
  for (let index = 1; index <= count; index++) {
    roundTokens.push({
      id: `token-${kind}-${index}`,
      texture: `images/splendor/tokens/${kind}.ktx2`,
      images: {
        front: `images/splendor/HR/token-${kind}.png`,
        back: `images/splendor/HR/token-${kind}.png`
      },
      x: 0,
      y: 0.05,
      z: 0,
      diameter: 2,
      height: 0.1
    })
  }
}

// 10 tiles
for (let index = 1; index <= 10; index++) {
  roundedTiles.push({
    id: `tile-${index}`,
    texture: `images/splendor/tiles/tile-${index}.ktx2`,
    images: {
      front: `images/splendor/HR/tile-${index}.png`,
      back: `images/splendor/HR/tile-back.png`
    },
    x: 0,
    z: 0,
    y: 0,
    width: 3,
    height: 3,
    depth: 0.05,
    borderRadius: 0.4,
    borderColor: [0, 0, 0, 1]
  })
}

const pickId = ({ id }) => id

// bags to randomize
export const bags = new Map([
  ['cards-level-1', cards.slice(0, 40).map(pickId)],
  ['cards-level-2', cards.slice(40, 70).map(pickId)],
  ['cards-level-3', cards.slice(70).map(pickId)],
  ...gems.map((kind, i) => [
    `tokens-${kind}`,
    roundTokens.slice(i * 8, (i + 1) * 8).map(pickId)
  ]),
  ['tokens-gold', roundTokens.slice(gems.length * 8).map(pickId)],
  ['tiles', roundedTiles.map(pickId)]
])

// pre-defined slots
export const slots = [
  { x: -8, z: 11.5, bagId: 'tiles', isFlipped: true },
  { x: 8, z: 7, bagId: 'cards-level-3', count: 1 },
  { x: 4, z: 7, bagId: 'cards-level-3', count: 1 },
  { x: 0, z: 7, bagId: 'cards-level-3', count: 1 },
  { x: -4, z: 7, bagId: 'cards-level-3', count: 1 },
  { x: -8, z: 7, bagId: 'cards-level-3', isFlipped: true },
  { x: 8, z: 2, bagId: 'cards-level-2', count: 1 },
  { x: 4, z: 2, bagId: 'cards-level-2', count: 1 },
  { x: 0, z: 2, bagId: 'cards-level-2', count: 1 },
  { x: -4, z: 2, bagId: 'cards-level-2', count: 1 },
  { x: -8, z: 2, bagId: 'cards-level-2', isFlipped: true },
  { x: 8, z: -3, bagId: 'cards-level-1', count: 1 },
  { x: 4, z: -3, bagId: 'cards-level-1', count: 1 },
  { x: 0, z: -3, bagId: 'cards-level-1', count: 1 },
  { x: -4, z: -3, bagId: 'cards-level-1', count: 1 },
  { x: -8, z: -3, bagId: 'cards-level-1', isFlipped: true },
  { x: -7, z: -7, bagId: 'tokens-gold' },
  { x: -4, z: -7, bagId: 'tokens-emerald' },
  { x: -1, z: -7, bagId: 'tokens-sapphire' },
  { x: 2, z: -7, bagId: 'tokens-diamond' },
  { x: 5, z: -7, bagId: 'tokens-quartz' },
  { x: 8, z: -7, bagId: 'tokens-ruby' }
]
