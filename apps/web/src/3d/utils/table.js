// @ts-check
/**
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@babylonjs/core').Material} Material
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Texture} Texture
 * @typedef {import('@tabulous/server/src/graphql').TableSpec} TableSpec
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js'

import { materialManager } from '../managers/material'

export const TableId = 'table'

/**
 * Creates ground mesh to act as table, that received shadows but can not receive rays.
 * Table is always 0.01 unit bellow (Y axis) origin.
 * @param {TableSpec|undefined} tableSpec - table parameters
 * @param {Scene} scene - scene to host the table (default to last scene).
 * @returns {Mesh} the created table ground.
 */
export function createTable(
  { width = 400, height = 400, texture } = {},
  scene
) {
  const table = CreateGround(TableId, { width: width, height: height }, scene)
  table.setAbsolutePosition(new Vector3(0, -0.01, 0))
  table.receiveShadows = true
  table.isPickable = false
  if (texture) {
    table.material = materialManager.buildOnDemand(texture, scene)
    const material = /** @type {Material & { diffuseTexture: Texture? }} */ (
      table.material
    )
    if (material.diffuseTexture) {
      material.diffuseTexture.uScale = 5
      material.diffuseTexture.vScale = 5
    }
  }
  return table
}
