import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color4 } from '@babylonjs/core/Maths/math.color'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder'

/**
 * Creates ground mesh to act as table, that received shadows but can not receive rays.
 * Table is always 0.01 unit bellow (Y axis) origin.
 * @param {object} params - table parameters, including:
 * @param {number} params.width? - table's width (X axis).
 * @param {number} params.height? - table's height (Y axis).
 * @param {number[]} params.color? - Color4's components used as table color.
 * @param {import('@babylonjs/core').Scene} scene? - scene to host the table (default to last scene).
 * @returns {import('@babylonjs/core').Mesh} the created table ground.
 */
export function createTable(
  { width = 400, height = 400, color = [0.2, 0.2, 0.2, 1] } = {},
  scene
) {
  const table = CreateGround('table', { width, height }, scene)
  table.position.y = -0.01
  table.receiveShadows = true

  table.material = new StandardMaterial('table-front', scene)
  table.material.emissiveColor = Color4.FromArray(color)
  table.isPickable = false
  return table
}
