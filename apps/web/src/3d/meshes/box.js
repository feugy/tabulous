import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'

import { controlManager } from '../managers/control'
import { materialManager } from '../managers/material'
import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'

/**
 * Creates a box.
 * A box's texture must have 6 faces, each with a different rotation (clockwise):
 *   1. negative Y (-90°)
 *   2. positive Y (-90°)
 *   3. negative X (-90°)
 *   4. positive X (-90°)
 *   5. negative Z (0°)
 *   6. positive Z (180°)
 * @param {object} params - box parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.id - box's unique id.
 * @param {string} params.texture - box's texture url or hexadecimal string color.
 * @param {number[][]} params.faceUV? - up to 6 face UV (Vector4 components), to map texture on the box.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {number} params.width? - box's width (X axis).
 * @param {number} params.height? - box's height (Y axis).
 * @param {number} params.depth? - box's depth (Z axis).
 * @param {import('@babylonjs/core').Scene} scene? - scene to host this box (default to last scene).
 * @returns the created box mesh.
 */
export function createBox(
  {
    id,
    x = 0,
    y = 0.5,
    z = 0,
    width = 1,
    height = 1,
    depth = 1,
    texture,
    faceUV = [
      [0 / 6, 0, 1 / 6, 1],
      [1 / 6, 0, 2 / 6, 1],
      [2 / 6, 0, 3 / 6, 1],
      [3 / 6, 0, 4 / 6, 1],
      [4 / 6, 0, 5 / 6, 1],
      [5 / 6, 0, 6 / 6, 1]
    ],
    ...behaviorStates
  } = {},
  scene
) {
  const mesh = CreateBox(
    id,
    {
      width,
      height,
      depth,
      faceUV: faceUV.map(components => Vector4.FromArray(components))
    },
    scene
  )
  mesh.name = 'box'
  materialManager.configure(mesh, texture)
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.isPickable = false
  mesh.isHittable = true

  mesh.metadata = {
    serialize: () => ({
      shape: mesh.name,
      id,
      x: mesh.absolutePosition.x,
      y: mesh.absolutePosition.y,
      z: mesh.absolutePosition.z,
      texture,
      faceUV,
      width,
      height,
      depth,
      ...serializeBehaviors(mesh.behaviors)
    })
  }

  registerBehaviors(mesh, behaviorStates)

  controlManager.registerControlable(mesh)
  return mesh
}
