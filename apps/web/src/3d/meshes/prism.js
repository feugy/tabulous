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
import { applyInitialTransform, setExtras } from '../utils/mesh'

/**
 * Creates a prism, with a given number of base edge (starting at 3).
 * A prism's texture must have edges + 2 faces, starting with back and ending with front, aligned horizontally.
 * By default, prisms have 6 edges and a width of 3.
 * @param {Omit<SerializedMesh, 'shape'>} params - prism parameters.
 * @param {Scene} scene - scene for the created mesh.
 * @returns {Mesh} the created prism mesh.
 */
export function createPrism(
  {
    id,
    x = 0,
    y = 0.5,
    z = 0,
    width = 3,
    height = 1,
    edges = 6,
    texture,
    faceUV = [
      [0 / 3, 0, 1 / 3, 1],
      [1 / 3, 0, 2 / 3, 1],
      [2 / 3, 0, 3 / 3, 1]
    ],
    transform = undefined,
    ...behaviorStates
  },
  scene
) {
  const mesh = CreateCylinder(
    id,
    {
      diameter: width,
      height,
      tessellation: edges,
      faceUV: faceUV.map(components => Vector4.FromArray(components))
    },
    scene
  )
  mesh.name = 'prism'
  materialManager.configure(mesh, texture)
  applyInitialTransform(mesh, transform)
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.isPickable = false

  setExtras(mesh, {
    isCylindric: true,
    metadata: {
      serialize: () => ({
        shape: /** @type {'prism'} */ (mesh.name),
        id,
        x: mesh.absolutePosition.x,
        y: mesh.absolutePosition.y,
        z: mesh.absolutePosition.z,
        texture,
        faceUV,
        transform,
        edges,
        width,
        height,
        ...serializeBehaviors(mesh.behaviors)
      })
    }
  })

  registerBehaviors(mesh, behaviorStates)

  controlManager.registerControlable(mesh)
  return mesh
}
