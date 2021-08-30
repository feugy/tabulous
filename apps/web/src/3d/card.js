import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Axis } from '@babylonjs/core/Maths/math.axis'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { PlaneBuilder } from '@babylonjs/core/Meshes/Builders/planeBuilder'
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
 * Creates a card mesh.
 * Cards are planes whith a given width and height (Babylon's depth), wrapped into a box mesh, so they could be stacked with other objects.
 * By default, the card dimension follows American poker card standard (beetween 1.39 & 1.41).
 * A card has the following behaviors:
 * - movable
 * - detailable
 * - flippable
 * - rotable
 * - stackable (the entire card is a drop target)
 * A card's texture must have 2 faces, back then front, aligned horizontally.
 * @param {object} params - card parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.texture - card's texture url.
 * @param {import('./utils').ImageDefs} params.images - detailed images for this car.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {number} params.width? - card's width (X axis).
 * @param {number} params.height? - card's height (Z axis).
 * @param {number} params.depth? - card's depth (Y axis).
 * @param {boolean} params.isFlipped? - initial flip state (face visible).
 * @param {number} params.flipDuration? - flip duration (in milliseconds).
 * @param {number} params.angle? - initial rotation angle (top above), in radians.
 * @param {number} params.rotateDuration? - rotation duration (in milliseconds).
 * @param {number} params.snapDistance? - distance bellow which the card automatically snaps to nearest position.
 * @param {number} params.moveDuration? - automatic move duration (in milliseconds), when snapping.
 * @returns {import('@babylonjs/core').Mesh} the created card mesh.
 */
export function createCard({
  x = 0,
  z = 0,
  y = 0,
  width = 3,
  height = 4.25,
  depth = 0.01,
  texture,
  isFlipped = false,
  angle = 0,
  flipDuration = 500,
  rotateDuration = 200,
  moveDuration = 100,
  snapDistance = 0.25,
  images,
  ...cardProps
} = {}) {
  const faces = PlaneBuilder.CreatePlane('faces', {
    width,
    height,
    frontUVs: new Vector4(0.5, 1, 0, 0),
    backUVs: new Vector4(0.5, 1, 1, 0),
    sideOrientation: Mesh.DOUBLESIDE
  })
  faces.receiveShadows = true
  faces.material = new StandardMaterial('faces')
  faces.material.diffuseTexture = new Texture(adaptTexture(texture))
  faces.material.diffuseTexture.hasAlpha = true
  faces.material.freeze()
  attachMaterialError(faces.material)

  const card = BoxBuilder.CreateBox('card', {
    width,
    height: depth,
    depth: height
  })

  // because planes are in 2-D, collisions with other meshes could be tricky.
  // wraps the plane with an invisible box. Box will take rays and pick operations.
  card.visibility = 0
  faces.rotate(Axis.X, Math.PI * 0.5)
  faces.position.y += depth * 0.5
  faces.isPickable = false
  faces.parent = card

  card.setAbsolutePosition(new Vector3(x, y, z))
  Object.assign(card, cardProps)

  card.metadata = {
    images,
    serialize: () => ({
      ...cardProps,
      x: card.position.x,
      y: card.position.y,
      z: card.position.z,
      width,
      height,
      depth,
      texture,
      images,
      ...flipBehavior.serialize(),
      ...rotateBehavior.serialize(),
      ...stackBehavior.serialize()
    })
  }

  faces.overlayColor = new Color3(0, 0.8, 0)
  faces.overlayAlpha = 0.2
  Object.defineProperty(card, 'renderOverlay', {
    get() {
      return faces.renderOverlay
    },
    set(value) {
      faces.renderOverlay = value
    }
  })

  card.addBehavior(new DetailBehavior(), true)

  const dragKind = 'card'
  card.addBehavior(
    new MoveBehavior({ moveDuration, snapDistance, dragKind }),
    true
  )

  const flipBehavior = new FlipBehavior({ duration: flipDuration, isFlipped })
  card.addBehavior(flipBehavior, true)

  const rotateBehavior = new RotateBehavior({ duration: rotateDuration, angle })
  card.addBehavior(rotateBehavior, true)

  const stackBehavior = new StackBehavior({ moveDuration })
  const dropZone = BoxBuilder.CreateBox('drop-zone', {
    width: width * 1.03,
    height: depth + 0.01,
    depth: height * 1.03
  })
  dropZone.parent = card
  stackBehavior.addZone(dropZone, 0.3, [dragKind])
  card.addBehavior(stackBehavior, true)

  controlManager.registerControlable(card)
  card.onDisposeObservable.addOnce(() =>
    controlManager.unregisterControlable(card)
  )
  return card
}
