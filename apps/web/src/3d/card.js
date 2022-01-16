import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Axis } from '@babylonjs/core/Maths/math.axis'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder'
import { controlManager } from './managers'
import {
  adaptTexture,
  attachMaterialError,
  registerBehaviors,
  serializeBehaviors
} from './utils'

/**
 * Creates a card mesh.
 * Cards are planes whith a given width and height (Babylon's depth), wrapped into a box mesh, so they could be stacked with other objects.
 * By default, the card dimension follows American poker card standard (beetween 1.39 & 1.41).
 * A card's texture must have 2 faces, back then front, aligned horizontally.
 * @param {object} params - card parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.id - card's unique id.
 * @param {string} params.texture - card's texture url.
 * @param {import('./utils').ImageDefs} params.images - detailed images for this car.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {number} params.width? - card's width (X axis).
 * @param {number} params.height? - card's height (Z axis).
 * @param {number} params.depth? - card's depth (Y axis).
 * @returns {import('@babylonjs/core').Mesh} the created card mesh.
 */
export function createCard({
  id,
  x = 0,
  z = 0,
  y = 0,
  width = 3,
  height = 4.25,
  depth = 0.01,
  texture,
  images,
  ...behaviorStates
} = {}) {
  const faces = CreatePlane(`${id}-plane`, {
    width,
    height,
    frontUVs: new Vector4(0.5, 1, 0, 0),
    backUVs: new Vector4(0.5, 1, 1, 0),
    sideOrientation: Mesh.DOUBLESIDE
  })
  faces.receiveShadows = true
  faces.material = new StandardMaterial(id)
  faces.material.diffuseTexture = new Texture(adaptTexture(texture))
  faces.material.diffuseTexture.hasAlpha = true
  faces.material.freeze()
  attachMaterialError(faces.material)

  const card = CreateBox('card', {
    width,
    height: depth,
    depth: height
  })
  card.id = id

  // because planes are in 2-D, collisions with other meshes could be tricky.
  // wraps the plane with an invisible box. Box will take rays and pick operations.
  card.visibility = 0
  faces.rotate(Axis.X, Math.PI * 0.5)
  faces.isPickable = false
  faces.parent = card

  card.setAbsolutePosition(new Vector3(x, y, z))

  card.metadata = {
    images,
    serialize: () => ({
      id,
      x: card.position.x,
      y: card.position.y,
      z: card.position.z,
      width,
      height,
      depth,
      texture,
      images,
      ...serializeBehaviors(card.behaviors)
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

  registerBehaviors(card, behaviorStates)

  controlManager.registerControlable(card)
  return card
}
