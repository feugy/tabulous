import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { controlManager, materialManager } from '../managers'
import { registerBehaviors, serializeBehaviors } from '../utils'

/**
 * Creates a prism, with a given number of base edge (starting at 3).
 * A prism's texture must have edges + 2 faces, starting with back and ending with front, aligned horizontally.
 * @param {object} params - prism parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.id - prism's unique id.
 * @param {string} params.texture - prism's texture url or hexadecimal string color.
 * @param {number[][]} params.faceUV? - up to 3 face UV (Vector4 components), to map texture to the prism.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {number} params.width? - prism's base size (X axis, size on Z depends on the number of edges).
 * @param {number} params.height? - prism's height (Y axis).
 * @param {import('@babylonjs/core').Scene} scene? - scene to host this round prism (default to last scene).
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
    ...behaviorStates
  } = {},
  scene
) {
  const mesh = CreateCylinder(
    'prism',
    {
      diameter: width,
      height,
      tessellation: edges,
      faceUV: faceUV.map(components => Vector4.FromArray(components))
    },
    scene
  )
  mesh.id = id
  materialManager.configure(mesh, texture)
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.isPickable = false

  mesh.metadata = {
    serialize: () => ({
      shape: mesh.name,
      id,
      x: mesh.position.x,
      y: mesh.position.y,
      z: mesh.position.z,
      texture,
      faceUV,
      edges,
      width,
      height,
      ...serializeBehaviors(mesh.behaviors)
    })
  }

  registerBehaviors(mesh, behaviorStates)

  controlManager.registerControlable(mesh)
  return mesh
}
