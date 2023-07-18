// @ts-check
import { randomUUID } from 'node:crypto'

import merge from 'deepmerge'

import { shuffle } from './collections.js'

/** @typedef {import('../services/players.js').Player} Player */
/** @typedef {import('../services/catalog.js').GameDescriptor} GameDescriptor */
/** @typedef {import('../services/games.js').GameData} GameData */
/** @typedef {import('../services/games.js').StartedGameData} StartedGameData */
/** @typedef {import('../services/games.js').GameParameters} GameParameters */
/** @typedef {import('../services/games.js').Schema} Schema */
/** @typedef {import('../services/games.js').Mesh} Mesh */
/** @typedef {import('../services/games.js').Anchor} Anchor */
/** @typedef {import('../services/games.js').Hand} Hand */
/** @typedef {import('../services/games.js').CameraPosition} CameraPosition */
/** @typedef {import('../services/games.js').PlayerPreference} PlayerPreference */
/** @typedef {Map<string, string[]>} Bags */

/**
 * @typedef {object} GameSetup setup for a given game instance, including meshes, bags and slots.
 * Meshes could be cards, round tokens, rounded tiles... They must have an id.
 * Use bags to randomize meshes, and use slots to assign them to given positions (and with specific properties).
 * Slot will stack onto meshes already there, optionnaly snapping them to an anchor.
 * Meshes remaining in bags after processing all slots will be removed.
 * @property {Mesh[]} [meshes] - all meshes.
 * @property {Bags} [bags] - map of randomized bags, as a list of mesh ids.
 * @property {Slot[]} [slots] - a list of position slots
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
 * @property {string} [anchorId] - id of the anchor to snap to.
 * @property {number} [count] - number of mesh drawn from bag.
 */

/**
 * Creates a unique game from a game descriptor.
 * @param {string} kind - created game's kind.
 * @param {Partial<GameDescriptor> & Pick<GameDescriptor, 'build'>} descriptor - to create game from.
 * @returns {Promise<Mesh[]>} a list of serialized 3D meshes.
 */
export async function createMeshes(kind, descriptor) {
  if (!descriptor || !descriptor.build) {
    throw new Error(`Game ${kind} does not export a build() function`)
  }
  const { slots, bags, meshes } = await descriptor.build()
  const meshById = cloneAll(meshes ?? [])
  const allMeshes = [...meshById.values()]
  const meshesByBagId = randomizeBags(bags, meshById)
  for (const slot of slots ?? []) {
    fillSlot(slot, meshesByBagId, allMeshes)
  }
  removeDandlingMeshes(meshesByBagId, allMeshes)
  return allMeshes
}

/**
 * @param {Mesh[]} meshes - meshes to clone.
 * @returns {Map<Mesh['id'], Mesh>} cloned meshes.
 */
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
 * @template {Pick<GameData, 'kind'> & Required<Pick<GameData, 'meshes'|'hands'>>} T
 * @param {T} game - altered game data.
 * @returns {T} the altered game data.
 */
export function enrichAssets(game) {
  const allMeshes = [
    ...game.meshes,
    ...game.hands.flatMap(({ meshes }) => meshes)
  ]
  if (game.kind) {
    for (const mesh of allMeshes) {
      if (isRelativeAsset(mesh.texture)) {
        mesh.texture = addAbsoluteAsset(mesh.texture, game.kind, 'texture')
      }
      if (mesh.file && isRelativeAsset(mesh.file)) {
        mesh.file = addAbsoluteAsset(mesh.file, game.kind, 'model')
      }
      if (mesh.detailable && isRelativeAsset(mesh.detailable.frontImage)) {
        mesh.detailable.frontImage = addAbsoluteAsset(
          mesh.detailable.frontImage,
          game.kind,
          'image'
        )
      }
      if (
        mesh.detailable?.backImage &&
        isRelativeAsset(mesh.detailable.backImage)
      ) {
        mesh.detailable.backImage = addAbsoluteAsset(
          mesh.detailable.backImage,
          game.kind,
          'image'
        )
      }
    }
  }
  return game
}

/**
 * @param {string} [path] - tested path.
 * @returns {boolean} whether this path is a relative assets.
 */
function isRelativeAsset(path) {
  return path && !path.startsWith('#') && !path.startsWith('/') ? true : false
}

/**
 * @param {string} path - relative path.
 * @param {string} kind - game kind.
 * @param {string} assetType - asset type.
 * @returns {string} the absolute asset path
 */
function addAbsoluteAsset(path, kind, assetType) {
  return `/${kind}/${assetType}s/${path}`
}

/**
 * @param {Bags|undefined} bags - a map of bags.
 * @param {Map<string, Mesh>} meshById - map of meshes.
 * @returns {Map<string, Mesh[]>} a list of randomized meshes per bags.
 */
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

/**
 * @param {Slot} slot - slot to fill.
 * @param {Map<string, Mesh[]>} meshesByBagId - randomized meshes per bags.
 * @param {Mesh[]} allMeshes - all meshes
 */
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
          const mesh = findMesh(anchor.snappedId, allMeshes)
          if (mesh) {
            meshes.splice(0, 0, mesh)
          }
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
 * @returns {?Anchor} the desired anchor, or null if it can't be found.
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
  return anchor ?? null
}

/**
 * @param {Anchor['id']} anchorId - anchor id.
 * @param {Mesh[]} meshes - list of mesh to search into.
 * @returns {?{ mesh: Mesh; anchor: Anchor }} tuple of mesh and anchor, if any.
 */
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

/**
 * @param {Map<string, Mesh[]>} meshesByBagId - list of meshes by bag.
 * @param {Mesh[]} allMeshes - list of all meshes.
 */
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
 * @param {StartedGameData} game - altered game data.
 * @param {object} params - operation parameters:
 * @param {string} params.playerId - player id for which meshes are drawn.
 * @param {string} params.fromAnchor - id of the anchor to draw from.
 * @param {number} [params.count = 1] - number of drawn mesh
 * @param {any} [params.props = {}] - other props merged into draw meshes.
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
  const stack = findMesh(anchor.snappedId, meshes)
  if (!stack) {
    return
  }
  for (let i = 0; i < count; i++) {
    const drawn = /** @type {Mesh} */ (drawMesh(stack, meshes) || stack)
    mergeProps(drawn, props)
    hand.meshes.push(drawn)
    meshes.splice(meshes.indexOf(drawn), 1)
    if (drawn === stack) {
      break
    }
  }
  if (stack.stackable?.stackIds?.length === 0) {
    anchor.snappedId = null
  }
}

/**
 * Finds the hand of a given player, optionally creating it.
 * @param {StartedGameData} game - altered game data.
 * @param {string} playerId - player id for which hand is created.
 * @returns  {Hand} existing hand, or created one.
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
 * @param {?string|undefined} id - desired mesh id.
 * @param {Mesh[]} meshes - mesh list to search in.
 * @returns {?Mesh} corresponding mesh, if any.
 */
export function findMesh(id, meshes) {
  return meshes?.find(mesh => mesh.id === id) ?? null
}

/**
 * Draw one or several meshes from a given stack.
 * @param {string} stackId - id of a stacked mesh to draw from.
 * @param {number} count - number of drawned meshes.
 * @param {Mesh[]} meshes - mesh list to search in.
 * @returns {Mesh[]} drawn meshes, if any.
 */
export function draw(stackId, count, meshes) {
  const drawn = []
  const stack = findMesh(stackId, meshes)
  if (stack) {
    for (let i = 0; i < count; i++) {
      drawn.push(drawMesh(stack, meshes))
    }
  }
  return /** @type {Mesh[]} */ (drawn.filter(Boolean))
}

/**
 * @param {Mesh} stack - stack to draw from.
 * @param {Mesh[]} meshes - mesh list to search in.
 * @returns {?Mesh} drawn meshes, if any.
 */
function drawMesh(stack, meshes) {
  if (stack.stackable?.stackIds?.length) {
    const id = stack.stackable.stackIds.pop()
    return findMesh(id, meshes)
  }
  return null
}

/**
 * Stack all provided meshes, in order (the first becomes stack base).
 * @param {Mesh[]} meshes - stacked meshes.
 */
export function stackMeshes(meshes) {
  const [base, ...others] = meshes
  const stackIds = others.map(({ id }) => id)
  if (stackIds.length) {
    mergeProps(base, { stackable: { stackIds } })
  }
}

/**
 * Snap a given mesh onto the specified anchor.
 * Search for the anchor within provided meshes.
 * If the anchor is already used, tries to stack the meshes (the current snapped mesh must be in provided meshes).
 * Abort the operation when meshes can't be stacked.
 * @param {string} anchorId - desired anchor id.
 * @param {Mesh|undefined} mesh - snapped mesh, if any.
 * @param {Mesh[]} meshes - all meshes to search the anchor in.
 * @return {boolean} true if the mesh could be snapped or stacked. False otherwise.
 */
export function snapTo(anchorId, mesh, meshes) {
  const anchor = findAnchor(anchorId, meshes)
  if (!anchor || !mesh) {
    return false
  }
  if (anchor.snappedId) {
    const snapped = findMesh(anchor.snappedId, meshes)
    if (!canStack(snapped, mesh)) {
      return false
    }
    stackMeshes([/** @type {Mesh} */ (snapped), mesh])
  } else {
    anchor.snappedId = mesh.id
  }
  return true
}

/**
 * Unsnapps a mesh from a given anchor.
 * @param {string} anchorId - desired anchor id.
 * @param {Mesh[]} meshes - all meshes to search the anchor in.
 * @returns {?Mesh} unsnapped meshes, or undefined if the anchor does not exist,
 * has no snapped mesh, or has an unexisting snapped mesh
 */
export function unsnap(anchorId, meshes) {
  const anchor = findAnchor(anchorId, meshes)
  if (!anchor || !anchor.snappedId) {
    return null
  }
  const id = anchor.snappedId
  anchor.snappedId = null
  return findMesh(id, meshes)
}

/**
 * @param {?Mesh|undefined} base - mesh base stack.
 * @param {?Mesh|undefined} mesh - mesh to stack onto the base.
 * @returns {boolean} whether this mesh can be stacked.
 */
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
 * @param {?Mesh|undefined} mesh - quantifiable mesh
 * @returns {?Mesh} the created object, if relevant
 */
export function decrement(mesh) {
  if (
    mesh?.quantifiable?.quantity !== undefined &&
    mesh.quantifiable.quantity > 1
  ) {
    const clone = merge(mesh, {
      id: `${mesh.id}-${randomUUID()}`,
      quantifiable: { quantity: 1 }
    })
    mesh.quantifiable.quantity--
    return clone
  }
  return null
}

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

/**
 * @param {CameraPosition} position - camera to extend with hash.
 * @returns {CameraPosition} the augmented camera.
 */
function addHash(position) {
  position.hash = `${position.target[0]}-${position.target[1]}-${position.target[2]}-${position.alpha}-${position.beta}-${position.elevation}`
  return position
}

/**
 * Loads a game descriptor's parameter schema.
 * If defined, enriches any image found;
 * @param {object} args - arguments, including:
 * @param {?Pick<GameDescriptor, 'askForParameters'>} args.descriptor - game descriptor.
 * @param {StartedGameData} args.game - current game's data.
 * @param {Player} args.player - player for which descriptor is retrieved.
 * @returns {Promise<?GameParameters>} the parameter schema, or null.
 */
export async function getParameterSchema({ descriptor, game, player }) {
  const schema = await descriptor?.askForParameters?.({ game, player })
  if (!schema) {
    return null
  }
  // TODO validates schema's compliance
  for (const property of Object.values(schema.properties)) {
    if (property.metadata?.images) {
      for (const [name, image] of Object.entries(property.metadata.images)) {
        if (isRelativeAsset(image) && game.kind) {
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

/**
 * Returns all possible values of a preference that were not picked by other players.
 * For example: `findAvailableValues(preferences, 'color', colors.players)` returns available colors.
 *
 * @param {PlayerPreference[]} preferences - list of player preferences objects.
 * @param {string} name - name of the preference considered.
 * @param {any[]} possibleValues - list of possible values.
 * @returns {any[]} filtered possible values (could be empty).
 */
export function findAvailableValues(preferences, name, possibleValues) {
  return possibleValues.filter(value =>
    preferences.every(pref => value !== pref[name])
  )
}
