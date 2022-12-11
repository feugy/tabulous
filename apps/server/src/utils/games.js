import { randomUUID } from 'crypto'
import merge from 'deepmerge'

import { shuffle } from './collections.js'

/** @typedef {import('../services/games.js').Game} Game */
/** @typedef {import('../services/games.js').Mesh} Mesh */
/** @typedef {import('../services/games.js').Anchor} Anchor */

/**
 * @typedef {object} GameDescriptor static descriptor of a game.
 *
 * @property {object} locales? - localized metadata like title.
 * @property {number} rulesBookPageCount? - number of pages in the rules book, if any.
 * @property {number} minTime? - minimum time in minutes.
 * @property {number} minAge? - minimum age in years.
 * @property {number} rulesBookPageCount? - number of pages in the rules book, if any.
 * @property {import('../services/games').ZoomSpec} zoomSpec? - zoom specifications for main and hand scene.
 * @property {import('../services/games').TableSpec} tableSpec? - table specifications.
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

/**
 * Walk through all game meshes (main scene and player hands)
 * to enrich their assets (textures, images, models) with absoluyte paths.
 * @param {Game} game - altered game data.
 * @returns {Game} the altered game data.
 */
export function enrichAssets(game) {
  const allMeshes = [
    ...game.meshes,
    ...game.hands.flatMap(({ meshes }) => meshes)
  ]
  for (const mesh of allMeshes) {
    if (isRelativeAsset(mesh.texture)) {
      mesh.texture = addAbsoluteAsset(mesh.texture, game.kind, 'texture')
    }
    if (isRelativeAsset(mesh.file)) {
      mesh.file = addAbsoluteAsset(mesh.file, game.kind, 'model')
    }
    if (isRelativeAsset(mesh.detailable?.frontImage)) {
      mesh.detailable.frontImage = addAbsoluteAsset(
        mesh.detailable.frontImage,
        game.kind,
        'image'
      )
    }
    if (isRelativeAsset(mesh.detailable?.backImage)) {
      mesh.detailable.backImage = addAbsoluteAsset(
        mesh.detailable.backImage,
        game.kind,
        'image'
      )
    }
  }
  return game
}

function isRelativeAsset(path) {
  return path && !path.startsWith('#') && !path.startsWith('/')
}

function addAbsoluteAsset(path, gameKind, assetType) {
  return `/${gameKind}/${assetType}s/${path}`
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
      mergeProps(mesh, props)
    }
    if (anchorId) {
      const anchor = findAnchor(anchorId, allMeshes)
      if (anchor) {
        if (anchor.snappedId) {
          meshes.splice(0, 0, findMeshById(anchor.snappedId, allMeshes))
        } else {
          anchor.snappedId = meshes[0].id
        }
      }
    }
    stackMeshes(meshes)
  }
}

/**
 * Crawl all meshes to find a given anchor Alter game data to draw some meshes from a given anchor into a player's hand.
 * @param {string} anchorId - desired anchor id.
 * @param {Mesh[]} meshes - list of mesh to search into.
 * @returns {Anchor|null} the desired anchor, or null if it can't be found.
 */
export function findAnchor(anchorId, meshes) {
  if (!meshes) {
    return null
  }
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
 * @param {Game} game - altered game data.
 * @param {object} params - operation parameters:
 * @param {string} params.playerId - player id for which meshes are drawn.
 * @param {number} params.count - number of drawn mesh
 * @param {string} params.fromAnchor - id of the anchor to draw from.
 * @param {any} params.props - other props merged into draw meshes.
 * @throws {Error} when no anchor could be found
 */
export function drawInHand(
  game,
  { playerId, count = 1, fromAnchor, props = {} }
) {
  const hand = findOrCreateHand(game, playerId)
  const { meshes } = game
  const anchor = findAnchor(fromAnchor, meshes)
  if (!anchor) {
    throw new Error(`no anchor with id '${fromAnchor}'`)
  }
  const stack = findMeshById(anchor.snappedId, meshes)
  if (!stack) {
    return
  }
  for (let i = 0; i < count; i++) {
    const drawn = drawMesh(stack, meshes) ?? stack
    mergeProps(drawn, props)
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

/**
 * Finds a mesh by id.
 * @param {string} id - desired mesh id.
 * @param {*} meshes - mesh list to search in.
 * @returns {import('../services/games').Mesh|null} corresponding mesh, if any.
 */
export function findMeshById(id, meshes) {
  return meshes?.find(mesh => mesh.id === id) ?? null
}

function drawMesh(stackMesh, meshes) {
  if (stackMesh.stackable?.stackIds.length) {
    const id = stackMesh.stackable.stackIds.pop()
    return findMeshById(id, meshes)
  }
}

/**
 * Stack all provided meshes, in order (the first becomes stack base).
 * @param {import('../services/games').Mesh[]} meshes - stacked meshes.
 */
export function stackMeshes(meshes) {
  const stackIds = meshes.slice(1).map(({ id }) => id)
  if (stackIds.length) {
    mergeProps(meshes[0], { stackable: { stackIds } })
  }
}

/**
 * Snap a given mesh onto the specified anchor.
 * Search for the anchor within provided meshes.
 * If the anchor is already used, tries to stack the meshes (the current snapped mesh must be in provided meshes).
 * Abort the operation when meshes can't be stacked.
 * @param {string} anchorId - desired anchor id.
 * @param {import('../services/games').Mesh} mesh? - snapped mesh, if any.
 * @param {import('../services/games').Mesh[]} meshes - all meshes to search the anchor in.
 * @return {boolean} true if the mesh could be snapped or stacked. False otherwise.
 */
export function snapTo(anchorId, mesh, meshes) {
  const anchor = findAnchor(anchorId, meshes)
  if (!anchor || !mesh) {
    return false
  }
  if (anchor.snappedId) {
    const snapped = findMeshById(anchor.snappedId, meshes)
    if (!canStack(snapped, mesh)) {
      return false
    }
    stackMeshes([snapped, mesh])
  } else {
    anchor.snappedId = mesh.id
  }
  return true
}

function canStack(base, mesh) {
  return Boolean(base?.stackable) && Boolean(mesh?.stackable)
}

/**
 * Deeply merge properties into an object
 * @param {object} object - the object to extend.
 * @param {object} props - an object deeply merged into the source.
 * @returns {object} the extended object.
 */
export function mergeProps(object, props) {
  return Object.assign(object, merge(object, props))
}

/**
 * Decrements a quantifiable mesh, by creating another one (when relevant)
 * @param {import('../services/games').Mesh} mesh - quantifiable mesh
 * @returns {import('../services/games').Mesh} the created object, if relevant
 */
export function decrement(mesh) {
  if (mesh?.quantifiable?.quantity > 1) {
    const clone = merge(mesh, {
      id: `${mesh.id}-${randomUUID()}`,
      quantifiable: { quantity: 1 }
    })
    mesh.quantifiable.quantity--
    return clone
  }
}

/**
 * @typedef {object} CameraPosition a saved Arc rotate camera position
 * @property {string} hash - hash for this position, to ease comparisons and change detections.
 * @property {string} playerId - id of the player for who this camera position is relevant.
 * @property {number} index - 0-based index for this saved position.
 * @property {number[]} target - 3D cooordinates of the camera target, as per Babylon's specs.
 * @property {number} alpha  - the longitudinal rotation, in radians.
 * @property {number} beta - the longitudinal rotation, in radians.
 * @property {number} elevation - the distance from the target (Babylon's radius).
 * @see https://doc.babylonjs.com/divingDeeper/cameras/camera_introduction#arc-rotate-camera
 */

/**
 * Builds a camera save for a given player, with default values:
 * - alpha = PI * 3/2 (south)
 * - beta = PI / 8 (slightly elevated from ground)
 * - elevation = 35
 * - target = [0,0,0] (the origin)
 * - index = 0 (default camera position)
 * It adds the hash.
 * @param {Partial<CameraPosition>} cameraPosition - a partial camera position without hash.
 * @returns {CameraPosition} the built camera position.
 */
export function buildCameraPosition({
  playerId,
  index = 0,
  target = [0, 0, 0],
  alpha = (3 * Math.PI) / 2,
  beta = Math.PI / 8,
  elevation = 35
} = {}) {
  if (!playerId) {
    throw new Error('camera position requires playerId')
  }
  return addHash({
    playerId,
    index,
    target,
    alpha,
    beta,
    elevation
  })
}

function addHash(camera) {
  camera.hash = `${camera.target[0]}-${camera.target[1]}-${camera.target[2]}-${camera.alpha}-${camera.beta}-${camera.elevation}`
  return camera
}

/**
 * Loads a game descriptor's parameter schema.
 * If defined, enriches any image found;
 * @param {object} args - arguments, including:
 * @param {object} args.descriptor - game descriptor.
 * @param {object} args.game - current game's data.
 * @param {object} args.player - player for which descriptor is retrieved.
 * @returns {Promise<object|null>} the parameter schema, or null.
 */
export async function getParameterSchema({ descriptor, game, player }) {
  const schema = await descriptor.askForParameters?.({ game, player })
  if (!schema) {
    return null
  }
  // TODO validates schema's compliance
  for (const property of Object.values(schema.properties)) {
    if (property.metadata?.images) {
      for (const [name, image] of Object.entries(property.metadata.images)) {
        if (isRelativeAsset(image)) {
          property.metadata.images[name] = addAbsoluteAsset(
            image,
            game.kind,
            'image'
          )
        }
      }
    }
  }
  return schema ? { ...game, schema } : null
}
