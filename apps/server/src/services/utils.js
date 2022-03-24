import merge from 'deepmerge'
import { shuffle } from '../utils/index.js'

/**
 * @typedef {object} GameDescriptor static descriptor of a game's meshes.
 * Meshes could be cards, round tokens and rounded tiles. They must have an id.
 * Meshes can be randomized in bags, then positioned on slots.
 * Slots could be either anchors on other meshes, or mesh stacks
 *
 * @property {import('./games').Mesh[]} meshes? - all meshes.
 * @property {Map<string, string[]>} bags? - map of randomized bags, as a list of mesh ids.
 * @property {Slot[]} slots? - a list of position slots
 * @property {number} rulesBookPageCount? - number of pages in the rules book, if any.
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
 * NOTICE: when using multiple slots on the same bag, slot with no count nor anchor MUST COME LAST.
 *
 * @property {string} bagId - id of a bag to pick meshes.
 * @property {string} anchorId? - id of the anchor to snap to.
 * @property {number} count? - number of mesh drawn from bag.
 */

/**
 * Creates a unique game from a game descriptor.
 * @param {string} kind - created game's kind.
 * @param {GameDescriptor} descriptor - to create game from.
 * @returns {import('./games').Mesh[]} a list of serialized 3D meshes.
 */
export function createMeshes(kind, descriptor) {
  const { slots } = descriptor
  const meshById = cloneAll(descriptor.meshes)
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
  const meshesByBagId = randomizeBags(descriptor.bags, meshById)
  for (const slot of slots ?? []) {
    fillSlot(slot, meshesByBagId, allMeshes)
  }
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

function addAbsoluteAsset(path, gameId, assetType) {
  return `/games/${gameId}/${assetType}s/${path}`
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
  if (candidates) {
    const meshes = candidates.splice(0, count ?? candidates.length)
    for (const mesh of meshes) {
      Object.assign(mesh, merge(mesh, props))
    }
    if (anchorId) {
      const anchor = findDeepAnchor(anchorId, allMeshes)
      if (anchor) {
        anchor.snappedId = meshes[0].id
      }
    }
    if (meshes.length > 1) {
      Object.assign(
        meshes[0],
        merge(meshes[0], {
          stackable: { stackIds: meshes.slice(1).map(({ id }) => id) }
        })
      )
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
