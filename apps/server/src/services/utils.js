import merge from 'deepmerge'
import { shuffle } from '../utils/index.js'

/**
 * @typedef {object} GameDescriptor static descriptor of a game's meshes.
 * Meshes could be cards, round tokens and rounded tiles. They must have an id.
 * Meshes are randomized in bags, then positioned on slots.
 *
 * @property {import('./games').Card[]} cards? - all cards.
 * @property {import('./games').RoundToken[]} roundTokens? - all round tokens.
 * @property {import('./games').RoundedTiles[]} roundedTiles? - all rounded tiles.
 * @property {Map<string, string[]>} bags? - map of randomized bags, as a list of mesh ids.
 * @property {Slot[]} slots? - a list of position slots
 */

/**
 * @typedef {object} Slot position slot for meshes.
 * A slot defines 3D coordinates for its meshes. Meshes will be picked out of a given bag, and stacked if needed.
 * Any other property define in bag will be assigned to positioned meshes.
 * NOTICE: when using multiple slots on the same bag, slot with no count MUST COME LAST.
 *
 * @property {string} bagId - id of a bag to pick meshes.
 * @property {number} count? - number of mesh drawn from bag. Draw all available meshes if not set.
 */

/**
 * Creates a unique game from a game descriptor.
 * @param {GameDescriptor} descriptor - to create game from.
 * @returns {import('./games').Scene} a 3D scene, ready to be loaded in the 3D engine.
 */
export function instanciateGame(descriptor = {}) {
  const { bags, slots, cards, roundTokens, roundedTiles } = descriptor
  // first, performs a deep copy
  const scene = merge(
    { cards, roundTokens, roundedTiles },
    { cards: [], roundTokens: [], roundedTiles: [] }
  )
  const randomized = new Map()
  const all = new Map()
  for (const mesh of [
    ...scene.cards,
    ...scene.roundTokens,
    ...scene.roundedTiles
  ]) {
    all.set(mesh.id, mesh)
  }

  // then, randomize each bags
  if (bags instanceof Map) {
    for (const [bagId, meshIds] of bags) {
      randomized.set(
        bagId,
        shuffle(meshIds)
          .map(id => all.get(id))
          .filter(Boolean)
      )
    }
  }

  // finally position on slots
  for (const { bagId, count, ...props } of slots ?? []) {
    const bag = randomized.get(bagId)
    if (bag) {
      const slotted = bag.splice(0, count ?? bag.length)
      for (const mesh of slotted) {
        Object.assign(mesh, props)
      }
      // slots with more than 1 mesh become stacks
      if (slotted.length > 1) {
        slotted[0].stack = slotted.slice(1).map(({ id }) => id)
      }
    }
  }

  return scene
}
