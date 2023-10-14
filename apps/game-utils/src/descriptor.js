// @ts-check
import merge from 'deepmerge'

import { shuffle } from './collection.js'
import { findAnchor, findMesh, stackMeshes } from './mesh.js'
import { mergeProps } from './utils.js'

/**
 * Creates a unique game from a game descriptor.
 * @template {Record<string, ?>} Parameters
 * @param {string} kind - created game's kind.
 * @param {Partial<import('@tabulous/types').GameDescriptor<Parameters>>} descriptor - to create game from.
 * @returns a list of serialized 3D meshes.
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
 * @param {import('@tabulous/types').Mesh[]} meshes - meshes to clone.
 * @returns cloned meshes.
 */
function cloneAll(meshes) {
  /** @type {Map<string, import('@tabulous/types').Mesh>} */
  const all = new Map()
  for (const mesh of meshes) {
    all.set(mesh.id, merge(mesh, {}))
  }
  return all
}

/**
 * Walk through all game meshes (main scene and player hands)
 * to enrich their assets (textures, images, models) with absoluyte paths.
 * @param {Partial<import('@tabulous/types').GameData>} game - altered game data.
 * @returns the altered game data.
 */
export function enrichAssets(game) {
  const allMeshes = [
    ...(game.meshes ?? []),
    ...(game.hands ?? []).flatMap(({ meshes }) => meshes)
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
 * @returns whether this path is a relative assets.
 */
export function isRelativeAsset(path) {
  return path && !path.startsWith('#') && !path.startsWith('/') ? true : false
}

/**
 * @param {string} path - relative path.
 * @param {string} kind - game kind.
 * @param {string} assetType - asset type.
 * @returns the absolute asset path
 */
export function addAbsoluteAsset(path, kind, assetType) {
  return `/${kind}/${assetType}s/${path}`
}

/**
 * @param {Map<string, string[]>|undefined} bags - a map of bags.
 * @param {Map<string, import('@tabulous/types').Mesh>} meshById - map of meshes.
 * @returns a list of randomized meshes per bags.
 */
function randomizeBags(bags, meshById) {
  /** @type {Map<string, import('@tabulous/types').Mesh[]>} */
  const meshesByBagId = new Map()
  if (bags instanceof Map) {
    for (const [bagId, meshIds] of bags) {
      meshesByBagId.set(
        bagId,
        /** @type {import('@tabulous/types').Mesh[]} */ (
          shuffle(meshIds)
            .map(id => meshById.get(id))
            .filter(Boolean)
        )
      )
    }
  }
  return meshesByBagId
}

/**
 * Picks in the bag as many random mesh as requested by the slot (defaults to all).
 * Then snaps as many meshes as possible to the slot's anchor (according to its max), and
 * stacks the remaining meshes on top of the first one.
 * When snapping on multiple anchors, meshes are NOT layed out.
 * @param {import('@tabulous/types').Slot} slot - slot to fill.
 * @param {Map<string, import('@tabulous/types').Mesh[]>} meshesByBagId - randomized meshes per bags.
 * @param {import('@tabulous/types').Mesh[]} allMeshes - all meshes
 */
function fillSlot(
  { bagId, anchorId, count, ...props },
  meshesByBagId,
  allMeshes
) {
  const candidates = meshesByBagId.get(bagId)
  if (candidates?.length) {
    const meshes = candidates.splice(0, count ?? candidates.length)
    /** @type {import('@tabulous/types').Mesh[]} */
    let stack = meshes
    for (const mesh of meshes) {
      mergeProps(mesh, props)
    }
    if (anchorId) {
      const anchor = findAnchor(anchorId, allMeshes)
      if (anchor) {
        const snapped = findMesh(anchor.snappedIds[0], allMeshes, false)
        stack = snapped ? [snapped] : []
        for (const mesh of meshes) {
          if (anchor.snappedIds.length === (anchor.max ?? 1)) {
            stack.push(mesh)
          } else {
            anchor.snappedIds.push(mesh.id)
            stack = [mesh]
            // TODO: lay out multiple meshes
          }
        }
      }
    }
    stackMeshes(stack)
  }
}

/**
 * @param {Map<string, import('@tabulous/types').Mesh[]>} meshesByBagId - list of meshes by bag.
 * @param {import('@tabulous/types').Mesh[]} allMeshes - list of all meshes.
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
 * Crawls game data to find mesh and anchor ids that are not unique.
 * Reports them on console.
 * @param {import('@tabulous/types').GameData} game - checked game data.
 * @param {boolean} throwViolations - whether to throw instead of reporting
 */
export function reportReusedIds(game, throwViolations = false) {
  const meshes = [...game.meshes, ...game.hands.flatMap(({ meshes }) => meshes)]
  const uniqueIds = new Set()
  const reusedIds = new Set()

  function check(
    /** @type {import('@tabulous/types').Mesh | import('@tabulous/types').Anchor} */ {
      id
    }
  ) {
    if (uniqueIds.has(id)) {
      reusedIds.add(id)
    } else {
      uniqueIds.add(id)
    }
  }
  for (const mesh of meshes) {
    check(mesh)
    mesh.anchorable?.anchors?.forEach(check)
  }
  if (reusedIds.size) {
    const message = `game ${game.kind} (${game.id}) has reused ids: ${[
      ...reusedIds
    ].join(', ')}`
    if (throwViolations) {
      throw new Error(message)
    }
    console.warn(message)
  }
}
