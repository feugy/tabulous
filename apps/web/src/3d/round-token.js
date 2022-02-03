import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { controlManager } from './managers'
import {
  adaptTexture,
  attachMaterialError,
  registerBehaviors,
  serializeBehaviors
} from './utils'

/**
 * Creates a round token, like a pocker one.
 * Tokens are cylinders, so their position is their center.
 * A token's texture must have 3 faces, back then edge then front, aligned horizontally.
 * @param {object} params - token parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.id - token's unique id.
 * @param {string} params.texture - token's texture url.
 * @param {number[][]} params.faceUV? - up to 3 face UV (Vector4 components), to map texture on the token.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {number} params.diameter? - token's diameter (X+Z axis).
 * @param {number} params.height? - token's height (Y axis).
 * @param {import('@babylonjs/core').Scene} scene? - scene to host this round token (default to last scene).
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
      [0, 0, 0.5, 1],
      [0, 0, 0, 0],
      [0.5, 0, 1, 1]
    ],
    ...behaviorStates
  } = {},
  scene
) {
  const token = CreateCylinder(
    'roundToken',
    {
      diameter,
      height,
      tessellation: 48,
      faceUV: faceUV.map(components => Vector4.FromArray(components))
    },
    scene
  )
  token.id = id
  token.material = new StandardMaterial(id, scene)
  token.material.diffuseTexture = new Texture(adaptTexture(texture), scene)
  token.material.diffuseTexture.hasAlpha = true
  token.material.freeze()
  attachMaterialError(token.material)

  token.receiveShadows = true
  token.setAbsolutePosition(new Vector3(x, y, z))
  token.isPickable = false

  token.metadata = {
    serialize: () => ({
      shape: token.name,
      id,
      x: token.position.x,
      y: token.position.y,
      z: token.position.z,
      texture,
      faceUV,
      diameter,
      height,
      ...serializeBehaviors(token.behaviors)
    })
  }

  token.overlayColor = new Color3(0, 0.8, 0)
  token.overlayAlpha = 0.2

  registerBehaviors(token, behaviorStates)

  controlManager.registerControlable(token)
  return token
}
