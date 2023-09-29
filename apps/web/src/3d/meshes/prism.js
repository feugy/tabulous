// @ts-check
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js'

import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'
import { applyInitialTransform, setExtras } from '../utils/mesh'

/**
 * Creates a prism, with a given number of base edge (starting at 3).
 * A prism's texture must have edges + 2 faces, starting with back and ending with front, aligned horizontally.
 * By default, prisms have 6 edges and a width of 3.
 * @param {Omit<import('@tabulous/types').Mesh, 'shape'>} params - prism parameters.
 * @param {import('../managers').Managers} managers - current managers.
 * @param {import('@babylonjs/core').Scene} scene - scene for the created mesh.
 * @returns the created prism mesh.
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
  managers,
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
  managers.material.configure(mesh, texture)
  applyInitialTransform(mesh, transform)
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.isPickable = false

  setExtras(mesh, {
    isCylindric: true,
    metadata: {
      serialize: () => ({
        shape: /** @type {import('@tabulous/types').Shape} */ (mesh.name),
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

  registerBehaviors(mesh, behaviorStates, managers)

  managers.control.registerControlable(mesh)
  return mesh
}
