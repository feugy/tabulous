// @ts-check
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js'

import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'
import { applyInitialTransform, setExtras } from '../utils/mesh'

/**
 * Creates a round token, like a pocker one.
 * Tokens are cylinders, so their position is their center.
 * A token's texture must have 3 faces, back then edge then front, aligned horizontally.
 * By default tokens have a diameter of 2.
 * @param {Omit<import('@src/3d/utils/behaviors').SerializedMesh, 'shape'>} params - token parameters.
 * @param {import('@babylonjs/core').Scene} scene - scene for the created mesh.
 * @param {import('@src/3d/managers').Managers} managers - current managers.
 * @returns the created token mesh.
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
  managers,
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
  managers.material.configure(mesh, texture)
  applyInitialTransform(mesh, transform)
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.isPickable = false

  setExtras(mesh, {
    isCylindric: true,
    metadata: {
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
  })

  registerBehaviors(mesh, behaviorStates, managers)

  managers.control.registerControlable(mesh)
  return mesh
}
