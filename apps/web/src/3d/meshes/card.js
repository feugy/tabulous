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
import { applyInitialTransform, setExtras } from '../utils/mesh'

/**
 * Creates a card mesh.
 * Cards are boxes whith a given width, height and depth. Only top and back faces UVs can be specified
 * By default, the card dimension follows American poker card standard (beetween 1.39 & 1.41).
 * A card's texture must have 2 faces, back then front, aligned horizontally.
 * @param {Omit<SerializedMesh, 'shape'>} params - card parameters.
 * @param {Scene} scene - scene for the created mesh.
 * @returns the created card mesh.
 */
export function createCard(
  {
    id,
    x = 0,
    z = 0,
    y = 0,
    width = 3,
    height = 0.01,
    depth = 4.25,
    texture,
    faceUV = [
      [0.5, 1, 0, 0],
      [0.5, 0, 1, 1]
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
      faceUV: [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        ...faceUV
      ].map(components => Vector4.FromArray(components)),
      faceColors: [],
      wrap: true
    },
    scene
  )
  mesh.name = 'card'
  materialManager.configure(mesh, texture)
  applyInitialTransform(mesh, transform)
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.isPickable = false

  setExtras(mesh, {
    metadata: {
      serialize: () => ({
        shape: /** @type {'card'} */ (mesh.name),
        id,
        x: mesh.absolutePosition.x,
        y: mesh.absolutePosition.y,
        z: mesh.absolutePosition.z,
        width,
        height,
        depth,
        texture,
        faceUV,
        transform,
        ...serializeBehaviors(mesh.behaviors)
      })
    }
  })

  registerBehaviors(mesh, behaviorStates)

  controlManager.registerControlable(mesh)
  return mesh
}
