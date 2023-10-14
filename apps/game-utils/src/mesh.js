// @ts-check
import merge from 'deepmerge'

import { mergeProps, popMesh } from './utils.js'

/**
 * @overload
 * Finds a mesh by id.
 * @param {?string|undefined} id - desired mesh id.
 * @param {import('@tabulous/types').Mesh[]} meshes - mesh list to search in.
 * @param {boolean} [throwOnMiss=true] - throws if mesh can't be found.
 * @returns {import('@tabulous/types').Mesh} corresponding mesh.
 *
 * @overload
 * Finds a mesh by id.
 * @param {?string|undefined} id - desired mesh id.
 * @param {import('@tabulous/types').Mesh[]} meshes - mesh list to search in.
 * @param {false} throwOnMiss - does not throw can't be found.
 * @returns {?import('@tabulous/types').Mesh} corresponding mesh, if any.
 */
export function findMesh(
  /** @type {?string|undefined} */ id,
  /** @type {import('@tabulous/types').Mesh[]} */ meshes,
  throwOnMiss = true
) {
  const mesh = meshes?.find(mesh => mesh.id === id) ?? null
  if (throwOnMiss && !mesh) {
    throw new Error(`No mesh with id ${id}`)
  }
  return mesh
}

/**
 * @overload
 * Finds an anchor from a path.
 * @param {string} path - path to the desired anchor id, its steps separated with '.'.
 * @param {import('@tabulous/types').Mesh[]} meshes - list of mesh to search into.
 * @param {boolean} [throwOnMiss=true]
 * @returns {import('@tabulous/types').Anchor} the desired anchor.
 * @throws {Error} when the anchor could not be found.
 *
 * @overload
 * Finds an anchor from a path. Can return null if no anchor could be found.
 * @param {string} path - path to the desired anchor id, its steps separated with '.'.
 * @param {import('@tabulous/types').Mesh[]} meshes - list of mesh to search into.
 * @param {false} throwOnMiss
 * @returns {?import('@tabulous/types').Anchor} the desired anchor, or null if it can't be found.
 */
export function findAnchor(
  /** @type {string} */ path,
  /** @type {import('@tabulous/types').Mesh[]} */ meshes,
  throwOnMiss = true
) {
  let candidates = [...(meshes ?? [])]
  let anchor
  for (let leg of path.split('.')) {
    const match = findMeshAndAnchor(leg, candidates, throwOnMiss)
    if (!match) {
      return null
    }
    candidates = meshes.filter(({ id }) => match.anchor.snappedIds.includes(id))
    anchor = match.anchor
  }
  return anchor ?? null
}

/**
 * @overload
 * Finds an anchor and its parent mesh.
 * @param {string} anchorId - anchor id.
 * @param {import('@tabulous/types').Mesh[]} meshes - list of mesh to search into.
 * @param {boolean} [throwOnMiss=true]
 * @returns {{ mesh: Mesh; anchor: import('@tabulous/types').Anchor }} tuple of mesh and anchor, if any.
 * @throws {Error} when no mesh with such anchor could be found.
 *
 * @overload
 * Finds an anchor and its parent mesh. Can return null id no mesh has such anchor.
 * @param {string} anchorId - anchor id.
 * @param {import('@tabulous/types').Mesh[]} meshes - list of mesh to search into.
 * @param {false} throwOnMiss
 * @returns {?{ mesh: Mesh; anchor: import('@tabulous/types').Anchor }} tuple of mesh and anchor, if any.
 */
function findMeshAndAnchor(
  /** @type {string} */ anchorId,
  /** @type {import('@tabulous/types').Mesh[]} */ meshes,
  throwOnMiss = true
) {
  for (const mesh of meshes) {
    for (const anchor of mesh.anchorable?.anchors ?? []) {
      if (anchor.id === anchorId) {
        return { mesh, anchor }
      }
    }
  }
  if (throwOnMiss) {
    throw new Error(`No anchor with id ${anchorId}`)
  }
  return null
}

/**
 * @overload
 * Pop one or several meshes from a given stack.
 * @param {string} stackId - id of a stacked mesh to draw from.
 * @param {number} count - number of drawned meshes.
 * @param {import('@tabulous/types').Mesh[]} meshes - mesh list to search in.
 * @param {boolean} [throwOnMiss=true]
 * @returns {import('@tabulous/types').Mesh[]} drawn meshes.
 * @throws {Error} when not all desired meshes could be drawn.
 *
 * @overload
 * Pop one or several meshes from a given stack.
 * Can return a smaller or empty array when not all desired mesh could be drawn.
 * @param {string} stackId - id of a stacked mesh to draw from.
 * @param {number} count - number of drawned meshes.
 * @param {import('@tabulous/types').Mesh[]} meshes - mesh list to search in.
 * @param {false} throwOnMiss
 * @returns {import('@tabulous/types').Mesh[]} drawn meshes, if any.
 */
export function pop(
  /** @type {string} */ stackId,
  /** @type {number} */ count,
  /** @type {import('@tabulous/types').Mesh[]} */ meshes,
  throwOnMiss = true
) {
  const drawn = []
  const stack = findMesh(stackId, meshes, throwOnMiss)
  if (stack) {
    for (let i = 0; i < count; i++) {
      const mesh = popMesh(stack, meshes, throwOnMiss)
      if (!mesh) {
        if (stack.stackable?.stackIds?.length === 0) {
          drawn.push(stack)
        }
        break
      }
      drawn.push(mesh)
    }
  }
  return drawn
}
/**
 * Stack all provided meshes, in order (the first becomes stack base).
 * @param {import('@tabulous/types').Mesh[]} meshes - stacked meshes.
 */
export function stackMeshes(meshes) {
  const [base, ...others] = meshes
  const stackIds = others.map(({ id }) => id)
  if (stackIds.length) {
    mergeProps(base, { stackable: { stackIds } })
  }
}

/**
 * @overload
 * Snap a given mesh onto the specified anchor.
 * Search for the anchor within provided meshes.
 * If the anchor is already used, tries to stack the meshes (the current snapped mesh must be in provided meshes).
 * Abort the operation when meshes can't be stacked.
 * @param {string} anchorId - desired anchor id.
 * @param {?import('@tabulous/types').Mesh} mesh - snapped mesh, if any.
 * @param {import('@tabulous/types').Mesh[]} meshes - all meshes to search the anchor in.
 * @param {boolean} [throwOnMiss=true]
 * @return {boolean} true if the mesh could be snapped or stacked. False otherwise.
 * @throws {Error} when mesh could not be snapped to anchor.
 *
 * @overload
 * Snap a given mesh onto the specified anchor.
 * Search for the anchor within provided meshes.
 * If the anchor is already used, tries to stack the meshes (the current snapped mesh must be in provided meshes).
 * Abort the operation when meshes can't be stacked, or if mesh can't be snapped to anchor.
 * @param {string} anchorId - desired anchor id.
 * @param {?import('@tabulous/types').Mesh} mesh - snapped mesh, if any.
 * @param {import('@tabulous/types').Mesh[]} meshes - all meshes to search the anchor in.
 * @param {false} throwOnMiss
 * @return {boolean} true if the mesh could be snapped or stacked. False otherwise.
 */
export function snapTo(
  /** @type {string} */ anchorId,
  /** @type {?import('@tabulous/types').Mesh} */ mesh,
  /** @type {import('@tabulous/types').Mesh[]} */ meshes,
  throwOnMiss = true
) {
  const anchor = findAnchor(anchorId, meshes, throwOnMiss)
  if (!anchor || !mesh) {
    if (throwOnMiss) {
      throw new Error(`No mesh to snap on anchor ${anchorId}`)
    }
    return false
  }
  if (anchor.snappedIds.length === (anchor.max ?? 1)) {
    const snapped = findMesh(anchor.snappedIds[0], meshes, throwOnMiss)
    if (!canStack(snapped, mesh)) {
      return false
    }
    stackMeshes([snapped, mesh])
  } else {
    anchor.snappedIds.push(mesh.id)
  }
  return true
}

/**
 * @overload
 * Unsnapps a mesh from a given anchor.
 * @param {string} anchorId - desired anchor id.
 * @param {import('@tabulous/types').Mesh[]} meshes - all meshes to search the anchor in.
 * @param {boolean} [throwOnMiss=true]
 * @returns {import('@tabulous/types').Mesh} unsnapped meshes, or null if anchor has no snapped mesh
 * @throws {Error} when anchor (or snapped mesh) could not be found.
 *
 * @overload
 * Unsnapps a mesh from a given anchor. Can return null if anchor (or snapped mesh) could not be found.
 * @param {string} anchorId - desired anchor id.
 * @param {import('@tabulous/types').Mesh[]} meshes - all meshes to search the anchor in.
 * @param {false} throwOnMiss
 * @returns {?import('@tabulous/types').Mesh} unsnapped meshes, or null if anchor does not exist, has no snapped mesh.
 */
export function unsnap(
  /** @type {string} */ anchorId,
  /** @type {import('@tabulous/types').Mesh[]} */ meshes,
  throwOnMiss = true
) {
  const anchor = findAnchor(anchorId, meshes, throwOnMiss)
  if (!anchor || anchor.snappedIds.length === 0) {
    if (throwOnMiss) {
      throw new Error(`Anchor ${anchorId} has no snapped mesh`)
    }
    return null
  }
  const [id] = anchor.snappedIds.splice(0, 1)
  return findMesh(id, meshes, throwOnMiss)
}

/**
 * @param {?import('@tabulous/types').Mesh|undefined} base - mesh base stack.
 * @param {?import('@tabulous/types').Mesh|undefined} mesh - mesh to stack onto the base.
 * @returns {boolean} whether this mesh can be stacked.
 */
function canStack(base, mesh) {
  return Boolean(base?.stackable) && Boolean(mesh?.stackable)
}

/**
 * @overload
 * Decrements a quantifiable mesh, by creating another one.
 * @param {?import('@tabulous/types').Mesh|undefined} mesh - quantifiable mesh
 * @param {boolean} [throwOnMiss=true]
 * @returns {import('@tabulous/types').Mesh} the created object
 * @throws {Error} when mesh can not be found or decremented.
 *
 * @overload
 * Decrements a quantifiable mesh, by creating another one.
 * Can return null if mesh can not be found or decremented.
 * @param {?import('@tabulous/types').Mesh|undefined} mesh - quantifiable mesh
 * @param {false} throwOnMiss
 * @returns {?import('@tabulous/types').Mesh} the created object, when relevant
 *
 * @param {?import('@tabulous/types').Mesh|undefined} mesh
 * @returns {?import('@tabulous/types').Mesh|undefined}
 */
export function decrement(mesh, throwOnMiss = true) {
  if (
    mesh?.quantifiable?.quantity !== undefined &&
    mesh.quantifiable.quantity > 1
  ) {
    const clone = merge(mesh, {
      id: `${mesh.id}-${crypto.randomUUID()}`,
      quantifiable: { quantity: 1 }
    })
    mesh.quantifiable.quantity--
    return clone
  }
  if (throwOnMiss) {
    throw new Error(
      `Mesh ${mesh?.id} is not quantifiable or has a quantity of 1`
    )
  }
  return null
}
