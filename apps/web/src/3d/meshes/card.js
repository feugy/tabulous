import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'
import { controlManager } from '../managers/control'
import { materialManager } from '../managers/material'
import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'

/**
 * Creates a card mesh.
 * Cards are boxes whith a given width, height and depth. Only top and back faces UVs can be specified
 * By default, the card dimension follows American poker card standard (beetween 1.39 & 1.41).
 * A card's texture must have 2 faces, back then front, aligned horizontally.
 * @param {object} params - card parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.id - card's unique id.
 * @param {string} params.texture - card's texture url or hexadecimal string color.
 * @param {number[][]} params.faceUV? - up to 2 face UV (Vector4 components), to map texture on the card.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {number} params.width? - card's width (X axis).
 * @param {number} params.height? - card's height (Y axis).
 * @param {number} params.depth? - card's depth (Z axis).
 * @param {import('@babylonjs/core').Scene} scene? - scene to host this card (default to last scene).
 * @returns {import('@babylonjs/core').Mesh} the created card mesh.
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
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.isPickable = false

  mesh.metadata = {
    serialize: () => ({
      shape: mesh.name,
      id,
      x: mesh.absolutePosition.x,
      y: mesh.absolutePosition.y,
      z: mesh.absolutePosition.z,
      width,
      height,
      depth,
      texture,
      faceUV,
      ...serializeBehaviors(mesh.behaviors)
    })
  }

  registerBehaviors(mesh, behaviorStates)

  controlManager.registerControlable(mesh)
  return mesh
}
