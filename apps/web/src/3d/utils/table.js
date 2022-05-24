import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder'
import { materialManager } from '../managers/material'

/**
 * Creates ground mesh to act as table, that received shadows but can not receive rays.
 * Table is always 0.01 unit bellow (Y axis) origin.
 * @param {object} params - table parameters, including:
 * @param {number} params.width? - table's width (X axis).
 * @param {number} params.height? - table's height (Y axis).
 * @param {string} params.texture - table's texture url or hexadecimal string color.
 * @param {import('@babylonjs/core').Scene} scene? - scene to host the table (default to last scene).
 * @returns {import('@babylonjs/core').Mesh} the created table ground.
 */
export function createTable(
  { width = 400, height = 400, texture } = {},
  scene
) {
  const table = CreateGround('table', { width: width, height: height }, scene)
  table.setAbsolutePosition(new Vector3(0, -0.01, 0))
  table.receiveShadows = true
  table.isPickable = false
  table.material = materialManager.buildOnDemand(texture, scene)
  if (table.material?.diffuseTexture) {
    table.material.diffuseTexture.uScale = 15
    table.material.diffuseTexture.vScale = 15
  }
  return table
}
