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
 * @param {import('./utils').ImageDefs} params.images - detailed images for this token.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {number} params.diameter? - token's diameter (X+Z axis).
 * @param {number} params.height? - token's height (Y axis).
 * @returns the created token mesh.
 */
export function createRoundToken({
  id,
  x = 0,
  y = 0.05,
  z = 0,
  diameter = 2,
  height = 0.1,
  texture,
  images,
  ...behaviorStates
} = {}) {
  const faceUV = [
    new Vector4(0, 0, 0.49, 1),
    new Vector4(0.49, 1, 0.509, 0),
    new Vector4(0.509, 0, 1, 1)
  ]
  const token = CreateCylinder('round-token', {
    diameter,
    height,
    tessellation: 48,
    faceUV
  })
  token.id = id
  token.material = new StandardMaterial(id)
  token.material.diffuseTexture = new Texture(adaptTexture(texture))
  token.material.diffuseTexture.hasAlpha = true
  token.material.freeze()
  attachMaterialError(token.material)

  token.receiveShadows = true
  token.setAbsolutePosition(new Vector3(x, y, z))

  token.metadata = {
    images,
    serialize: () => ({
      id,
      x: token.position.x,
      y: token.position.y,
      z: token.position.z,
      texture,
      diameter,
      height,
      images,
      ...serializeBehaviors(token.behaviors)
    })
  }

  token.overlayColor = new Color3(0, 0.8, 0)
  token.overlayAlpha = 0.2

  registerBehaviors(token, behaviorStates)

  controlManager.registerControlable(token)
  return token
}
