// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/utils/behaviors').SerializedMesh} SerializedMesh
 */

import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js'

import { controlManager } from '../managers/control'
import { materialManager } from '../managers/material'
import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'
import { applyInitialTransform } from '../utils/mesh'

/**
 * Creates a round token, like a pocker one.
 * Tokens are cylinders, so their position is their center.
 * A token's texture must have 3 faces, back then edge then front, aligned horizontally.
 * By default tokens have a diameter of 2.
 * @param {Omit<SerializedMesh, 'shape'>} params - token parameters.
 * @param {Scene} scene - scene for the created mesh.
 * @returns {Mesh} the created token mesh.
 */
export function createRoundToken(
  {
    id,
    x = 0,
    y = 0.05,
    z = 0,
    diameter = 2,
    height = 0.1,
    texture,
    faceUV = [
      [0, 1, 0.5, 0],
      [0, 0, 0, 0],
      [0.5, 1, 1, 0]
    ],
    transform = undefined,
    ...behaviorStates
  },
  scene
) {
  const mesh = CreateCylinder(
    id,
    {
      diameter,
      height,
      tessellation: 48,
      faceUV: faceUV.map(components => Vector4.FromArray(components))
    },
    scene
  )
  mesh.name = 'roundToken'
  materialManager.configure(mesh, texture)
  applyInitialTransform(mesh, transform)
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.isPickable = false
  mesh.isHittable = true
  mesh.isCylindric = true

  mesh.metadata = {
    serialize: () => ({
      shape: /** @type {'roundToken'} */ (mesh.name),
      id,
      x: mesh.absolutePosition.x,
      y: mesh.absolutePosition.y,
      z: mesh.absolutePosition.z,
      texture,
      faceUV,
      transform,
      diameter,
      height,
      ...serializeBehaviors(mesh.behaviors)
    })
  }

  registerBehaviors(mesh, behaviorStates)

  controlManager.registerControlable(mesh)
  return mesh
}
