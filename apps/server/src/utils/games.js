import merge from 'deepmerge'
import { shuffle } from './collections.js'

/**
 * @typedef {object} GameDescriptor static descriptor of a game.
 *
 * @property {object} locales? - localized metadata like title.
 * @property {number} rulesBookPageCount? - number of pages in the rules book, if any.
 * @property {number} minTime? - minimum time in minutes.
 * @property {number} minAge? - minimum age in years.
 * @property {() => Promise<GameSetup>} build - function to build initial game
 */

/**
 * @typedef {object} GameSetup setup for a given game instance, including meshes, bags and slots.
 * Meshes could be cards, round tokens, rounded tiles... They must have an id.
 * Use bags to randomize meshes, and use slots to assign them to given positions (and with specific properties).
 * Slot will stack onto meshes already there, optionnaly snapping them to an anchor.
 * Meshes remaining in bags after processing all slots will be removed.
 * @property {import('../services/games').Mesh[]} meshes? - all meshes.
 * @property {Map<string, string[]>} bags? - map of randomized bags, as a list of mesh ids.
 * @property {Slot[]} slots? - a list of position slots
 */

/**
 * @typedef {object} Slot position slot for meshes.
 * A slot draw a mesh from a bag (`bagId`), and assigns it provided propertis (x, y, z, texture, movable...).
 *
 * Slots without an anchor picks as many meshes as needed (count), and stack them.
 * When there is no count, they exhaust the bag.
 *
 * Slots with an anchor (`anchorId`) draw as many mesh as needed (count),
 * snap the first to any other mesh with that anchor, and stack others on top of it.
 * `anchorId` may be a chain of anchors: "column-2.bottom.top" draw and snaps on anchor "top", of a mesh snapped on
 * anchor "bottom", of a mesh snapped on anchor "column-2".
 * If such configuration can not be found, the slot is ignored.
 *
 * NOTES:
 * 1. when using multiple slots on the same bag, slot with no count nor anchor MUST COME LAST.
 * 2. meshes remaining in bags after processing all slots will be removed.
 *
 * @property {string} bagId - id of a bag to pick meshes.
 * @property {string} anchorId? - id of the anchor to snap to.
 * @property {number} count? - number of mesh drawn from bag.
 */

/**
 * Creates a unique game from a game descriptor.
 * @async
 * @param {string} kind - created game's kind.
 * @param {GameDescriptor} descriptor - to create game from.
 * @returns {import('../services/games').Mesh[]} a list of serialized 3D meshes.
 */
export async function createMeshes(kind, descriptor) {
  const { slots, bags, meshes } = await descriptor.build()
  const meshById = cloneAll(meshes)
  const allMeshes = [...meshById.values()]
  for (const mesh of allMeshes) {
    if (isRelativeAsset(mesh.texture)) {
      mesh.texture = addAbsoluteAsset(mesh.texture, kind, 'texture')
    }
    if (isRelativeAsset(mesh.file)) {
      mesh.file = addAbsoluteAsset(mesh.file, kind, 'model')
    }
    if (isRelativeAsset(mesh.detailable?.frontImage)) {
      mesh.detailable.frontImage = addAbsoluteAsset(
        mesh.detailable.frontImage,
        kind,
        'image'
      )
    }
    if (isRelativeAsset(mesh.detailable?.backImage)) {
      mesh.detailable.backImage = addAbsoluteAsset(
        mesh.detailable.backImage,
        kind,
        'image'
      )
    }
  }
  const meshesByBagId = randomizeBags(bags, meshById)
  for (const slot of slots ?? []) {
    fillSlot(slot, meshesByBagId, allMeshes)
  }
  removeDandlingMeshes(meshesByBagId, allMeshes)
  return allMeshes
}

function cloneAll(meshes) {
  const all = new Map()
  for (const mesh of meshes) {
    all.set(mesh.id, merge(mesh, {}))
  }
  return all
}

function isRelativeAsset(path) {
  return path && !path.startsWith('#') && !path.startsWith('/')
}

/**
 * Adds prefix to a given's game asset, including game id and asset type.
 * @param {string} path - path to the desired asset
 * @param {string} gameKind - kind (name) of the game
 * @param {string} assetType - either model, texture or image
 * @returns {string} the final, full, asset path
 */
export function addAbsoluteAsset(path, gameKind, assetType) {
  return `/games/${gameKind}/${assetType}s/${path}`
}

function randomizeBags(bags, meshById) {
  const meshesByBagId = new Map()
  if (bags instanceof Map) {
    for (const [bagId, meshIds] of bags) {
      meshesByBagId.set(
        bagId,
        shuffle(meshIds)
          .map(id => meshById.get(id))
          .filter(Boolean)
      )
    }
  }
  return meshesByBagId
}

function fillSlot(
  { bagId, anchorId, count, ...props },
  meshesByBagId,
  allMeshes
) {
  const candidates = meshesByBagId.get(bagId)
  if (candidates?.length) {
    const meshes = candidates.splice(0, count ?? candidates.length)
    for (const mesh of meshes) {
      Object.assign(mesh, merge(mesh, props))
    }
    let base = meshes[0]
    let sliced = 1
    if (anchorId) {
      const anchor = findDeepAnchor(anchorId, allMeshes)
      if (anchor) {
        if (anchor.snappedId) {
          base = findMesh(anchor.snappedId, allMeshes)
          sliced = 0
        } else {
          anchor.snappedId = base.id
        }
      }
    }
    const stackIds = meshes.slice(sliced).map(({ id }) => id)
    if (stackIds.length) {
      Object.assign(base, merge(base, { stackable: { stackIds } }))
    }
  }
}

function findDeepAnchor(anchorId, meshes) {
  let candidates = [...meshes]
  let anchor
  for (let leg of anchorId.split('.')) {
    const match = findMeshAndAnchor(leg, candidates)
    if (!match) {
      return null
    }
    candidates = meshes.filter(({ id }) => id === match.anchor.snappedId)
    anchor = match.anchor
  }
  return anchor
}

function findMeshAndAnchor(anchorId, meshes) {
  for (const mesh of meshes) {
    for (const anchor of mesh.anchorable?.anchors ?? []) {
      if (anchor.id === anchorId) {
        return { mesh, anchor }
      }
    }
  }
  return null
}

function removeDandlingMeshes(meshesByBagId, allMeshes) {
  const removedIds = []
  for (const [, meshes] of meshesByBagId) {
    removedIds.push(...meshes.map(({ id }) => id))
  }
  for (const id of removedIds) {
    allMeshes.splice(
      allMeshes.findIndex(mesh => mesh.id === id),
      1
    )
  }
}

/**
 * Alter game data to draw some meshes from a given anchor into a player's hand.
 * Automatically creates player hands if needed.
 * If provided anchor has fewer meshes as requested, depletes it.
 * @param {import('../services/games.js').Game} game - altered game data.
 * @param {object} params - operation parameters:
 * @param {string} params.playerId - player id for which meshes are drawn.
 * @param {number} params.count - number of drawn mesh
 * @param {string} params.fromAnchor - id of the anchor to draw from.
 * @throws {Error} when no anchor could be found
 */
export function drawInHand(game, { playerId, count = 1, fromAnchor }) {
  const hand = findOrCreateHand(game, playerId)
  const { meshes } = game
  const anchor = findDeepAnchor(fromAnchor, meshes)
  if (!anchor) {
    throw new Error(`no anchor with id '${fromAnchor}'`)
  }
  const stack = findMesh(anchor.snappedId, meshes)
  if (!stack) {
    return
  }
  for (let i = 0; i < count; i++) {
    const drawn = drawMesh(stack, meshes) ?? stack
    hand.meshes.push(drawn)
    meshes.splice(meshes.indexOf(drawn), 1)
    if (drawn === stack) {
      break
    }
  }
  if (stack.stackable?.stackIds.length === 0) {
    anchor.snappedId = null
  }
}

/**
 * Finds the hand of a given player, optionally creating it.
 * @param {import('../services/games').Game} game - altered game data.
 * @param {string} playerId - player id for which hand is created.
 * @returns  {import('../services/games').Hand} existing hand, or created one.
 */
export function findOrCreateHand(game, playerId) {
  let hand = game.hands.find(hand => hand.playerId === playerId)
  if (!hand) {
    hand = { playerId, meshes: [] }
    game.hands.push(hand)
  }
  return hand
}

function findMesh(id, meshes) {
  return meshes.find(mesh => mesh.id === id) ?? null
}

function drawMesh(stackMesh, meshes) {
  if (stackMesh.stackable?.stackIds.length) {
    const id = stackMesh.stackable.stackIds.pop()
    return findMesh(id, meshes)
  }
}
