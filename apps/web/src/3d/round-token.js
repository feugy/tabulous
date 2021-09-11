import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector'
import { CylinderBuilder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import {
  DetailBehavior,
  FlipBehavior,
  MoveBehavior,
  RotateBehavior,
  StackBehavior
} from './behaviors'
import { controlManager } from './managers'
import { adaptTexture, attachMaterialError } from './utils'

/**
 * Creates a round token, like a pocker one.
 * Tokens are cylinders, so their position is their center (half their height).
 * A token has the following behaviors:
 * - movable
 * - detailable
 * - flippable
 * - rotable
 * - stackable (the token token is a drop target)
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
 * @param {boolean} params.isFlipped? - initial flip state (face visible).
 * @param {number} params.flipDuration? - flip duration (in milliseconds).
 * @param {number} params.angle? - initial rotation angle (top above), in radians.
 * @param {number} params.rotateDuration? - rotation duration (in milliseconds).
 * @param {number} params.snapDistance? - distance bellow which the token automatically snaps to nearest position.
 * @param {number} params.moveDuration? - automatic move duration (in milliseconds), when snapping.
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
  isFlipped = false,
  angle = 0,
  flipDuration = 500,
  rotateDuration = 200,
  moveDuration = 100,
  snapDistance = 0.25,
  images,
  ...tokenProps
} = {}) {
  const faceUV = [
    new Vector4(0, 0, 0.49, 1),
    new Vector4(0.49, 1, 0.509, 0),
    new Vector4(0.509, 0, 1, 1)
  ]
  const token = CylinderBuilder.CreateCylinder(id, {
    diameter,
    height,
    tessellation: 48,
    faceUV
  })
  token.material = new StandardMaterial(id)
  token.material.diffuseTexture = new Texture(adaptTexture(texture))
  token.material.diffuseTexture.hasAlpha = true
  token.material.freeze()
  attachMaterialError(token.material)

  token.receiveShadows = true
  token.setAbsolutePosition(new Vector3(x, y, z))
  Object.assign(token, tokenProps)

  token.metadata = {
    images,
    serialize: () => ({
      ...tokenProps,
      id,
      x: token.position.x,
      y: token.position.y,
      z: token.position.z,
      texture,
      diameter,
      height,
      images,
      ...flipBehavior.serialize(),
      ...rotateBehavior.serialize(),
      ...stackBehavior.serialize()
    })
  }

  token.overlayColor = new Color3(0, 0.8, 0)
  token.overlayAlpha = 0.2

  token.addBehavior(new DetailBehavior(), true)

  const dragKind = 'round-token'
  token.addBehavior(
    new MoveBehavior({ moveDuration, snapDistance, dragKind }),
    true
  )

  const flipBehavior = new FlipBehavior({ duration: flipDuration, isFlipped })
  token.addBehavior(flipBehavior, true)

  const rotateBehavior = new RotateBehavior({ duration: rotateDuration, angle })
  token.addBehavior(rotateBehavior, true)

  const stackBehavior = new StackBehavior({ moveDuration })
  const dropZone = CylinderBuilder.CreateCylinder('drop-zone', {
    diameter: diameter * 1.03,
    height: height + 0.02
  })
  dropZone.parent = token
  stackBehavior.addZone(dropZone, 0.6, [dragKind])
  token.addBehavior(stackBehavior, true)

  controlManager.registerControlable(token)
  token.onDisposeObservable.addOnce(() =>
    controlManager.unregisterControlable(token)
  )
  return token
}
