/**
 * Minimum time in minutes.
 */
export const minTime = 10

/**
 * Minimum age in years.
 */
export const minAge = 4

/**
 * Rules on 2 pages.
 */
export const rulesBookPageCount = 2

/**
 * 12 tops (2 of each kind)
 * 12 bottoms (2 of each kind)
 * 1 pawn
 * @type {import('../src/services/games').Mesh[]}
 */
export const meshes = []

const positions = ['top', 'bottom']

const depth = 5.6
const width = 8.7
const height = 0.01
const shift = width * 1.25
const startX = shift * -3

const cardBags = { top: [], bottom: [] }

for (const position of positions) {
  for (let index = 0; index < 12; index++) {
    const id = `${position}-${index + 1}`
    meshes.push({
      id,
      shape: 'card',
      texture: `images/prima-ballerina/${position}-${(index % 6) + 1}.ktx2`,
      x: 0,
      y: 0,
      z: 0,
      width,
      height,
      depth,
      // use all defaults
      movable: {},
      stackable: {},
      flippable: { isFlipped: true }
    })
    cardBags[position].push(id)
  }
}

meshes.push({
  shape: 'custom',
  id: 'pawn',
  file: 'models/prima-ballerina/pawn.babylon',
  texture: '#D8637DFF',
  x: startX,
  z: depth + 1.5,
  movable: {},
  flippable: {},
  rotable: {}
})

/**
 * Bags to randomize:
 * - one for tops
 * - one for bottoms
 * @type {Map<string, string[]>}
 */
export const bags = new Map([
  ['tops', cardBags.top],
  ['bottoms', cardBags.bottom]
])

/**
 * Pre-define slots:
 * - 7 tops
 * - 7 bottoms
 * - remaining tops
 * - remaining bottoms
 * @type {import('../src/services/utils').Slot[]}
 */
export const slots = []

for (let index = 0; index < 7; index++) {
  slots.push(
    {
      bagId: 'tops',
      x: startX + index * shift,
      z: depth * 0.5,
      count: 1,
      flippable: { isFlipped: index !== 0 }
    },
    {
      bagId: 'bottoms',
      x: startX + index * shift,
      z: depth * -0.5,
      count: 1,
      flippable: { isFlipped: index !== 0 }
    }
  )
}

slots.push(
  { bagId: 'tops', x: startX, z: depth * 4 },
  { bagId: 'bottoms', x: startX, z: depth * 3 }
)
