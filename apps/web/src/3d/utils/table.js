// @ts-check
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js'

export const TableId = 'table'

/**
 * Creates ground mesh to act as table, that received shadows but can not receive rays.
 * Table is always 0.01 unit bellow (Y axis) origin.
 * @param {import('@tabulous/server/src/graphql').TableSpec|undefined} tableSpec - table parameters
 * @param {import('@src/3d/managers').Managers} managers - current managers.
 * @param {import('@babylonjs/core').Scene} scene - scene to host the table (default to last scene).
 * @returns the created table ground.
 */
export function createTable(
  { width = 400, height = 400, texture } = {},
  managers,
  scene
) {
  const table = CreateGround(TableId, { width: width, height: height }, scene)
  table.setAbsolutePosition(new Vector3(0, -0.01, 0))
  table.receiveShadows = true
  table.isPickable = false
  if (texture) {
    table.material = managers.material.buildOnDemand(texture, scene)
    const material =
      /** @type {import('@babylonjs/core').Material & { diffuseTexture: import('@babylonjs/core').Texture? }} */ (
        table.material
      )
    if (material.diffuseTexture) {
      material.diffuseTexture.uScale = 5
      material.diffuseTexture.vScale = 5
    }
  }
  return table
}
