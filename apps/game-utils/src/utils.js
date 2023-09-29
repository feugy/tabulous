// @ts-check
import merge from 'deepmerge'

import { findMesh } from './mesh.js'

/**
 * Deeply merge properties into an object
 * @template {Record<string, any>} Base
 * @template {Record<string, any>} Extension
 * @param {Base} object - the object to extend.
 * @param {Extension} props - an object deeply merged into the source.
 * @returns {Base & { [x: keyof Extension]: any }} the extended object.
 */
export function mergeProps(object, props) {
  return Object.assign(object, merge(object, props))
}

/**
 * @overload
 * Pop a single mesh from a stack.
 * @param {import('@tabulous/types').Mesh} stack - stacked mesh to draw from.
 * @param {import('@tabulous/types').Mesh[]} meshes - mesh list to search in.
 * @param {boolean} [throwOnMiss=true]
 * @returns {import('@tabulous/types').Mesh} drawn mesh.
 * @throws {Error} when no mesh could be drawn.
 *
 * @overload
 * Pop a single mesh from a stack. Can return null if no mesh could be drawn.
 * @param {import('@tabulous/types').Mesh} stack - stacked mesh to draw from.
 * @param {import('@tabulous/types').Mesh[]} meshes - mesh list to search in.
 * @param {false} throwOnMiss
 * @returns {?import('@tabulous/types').Mesh} drawn meshes, if any.
 */
export function popMesh(
  /** @type {import('@tabulous/types').Mesh} */ stack,
  /** @type {import('@tabulous/types').Mesh[]} */ meshes,
  throwOnMiss = true
) {
  if (!stack.stackable?.stackIds && throwOnMiss) {
    throw new Error(`Mesh ${stack.id} is not stackable`)
  }
  if (stack.stackable?.stackIds?.length) {
    const id = stack.stackable.stackIds.pop()
    return findMesh(id, meshes, throwOnMiss)
  }
  return null
}
