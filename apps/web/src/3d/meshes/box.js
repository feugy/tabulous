// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/utils/behaviors').SerializedMesh} SerializedMesh
 */

import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'

import { controlManager } from '../managers/control'
import { materialManager } from '../managers/material'
import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'
import { applyInitialTransform } from '../utils/mesh'

/**
 * Creates a box.
 * A box's texture must have 6 faces, each with a different rotation (clockwise):
 *   1. negative Y (-90°)
 *   2. positive Y (-90°)
 *   3. negative X (-90°)
 *   4. positive X (-90°)
 *   5. negative Z (0°)
 *   6. positive Z (180°)
 * By default, boxes have a dimension of 1.
 * @param {Omit<SerializedMesh, 'shape'>} params - box parameters.
 * @param {Scene} scene - scene for the created mesh.
 * @returns {Mesh} the created box mesh.
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
    transform = undefined,
    ...behaviorStates
  },
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
  applyInitialTransform(mesh, transform)
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.isPickable = false
  mesh.isHittable = true

  mesh.metadata = {
    serialize: () => ({
      shape: /** @type {'box'} */ (mesh.name),
      id,
      x: mesh.absolutePosition.x,
      y: mesh.absolutePosition.y,
      z: mesh.absolutePosition.z,
      texture,
      faceUV,
      transform,
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
