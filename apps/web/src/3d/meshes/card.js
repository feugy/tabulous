import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Axis } from '@babylonjs/core/Maths/math.axis'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder'
import { controlManager } from '../managers/control'
import {
  adaptTexture,
  attachMaterialError,
  registerBehaviors,
  serializeBehaviors
} from '../utils'

/**
 * Creates a card mesh.
 * Cards are planes whith a given width and height (Babylon's depth), wrapped into a box mesh, so they could be stacked with other objects.
 * By default, the card dimension follows American poker card standard (beetween 1.39 & 1.41).
 * A card's texture must have 2 faces, back then front, aligned horizontally.
 * @param {object} params - card parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.id - card's unique id.
 * @param {string} params.texture - card's texture url.
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
      [0.5, 1, 1, 0]
    ],
    ...behaviorStates
  } = {},
  scene
) {
  const faces = CreatePlane(
    `plane-${id}`,
    {
      width,
      height: depth,
      frontUVs: Vector4.FromArray(faceUV[0]),
      backUVs: Vector4.FromArray(faceUV[1]),
      sideOrientation: Mesh.DOUBLESIDE
    },
    scene
  )
  faces.receiveShadows = true
  faces.material = new StandardMaterial(id, scene)
  faces.material.diffuseTexture = new Texture(adaptTexture(texture), scene)
  faces.material.diffuseTexture.hasAlpha = true
  faces.material.freeze()
  attachMaterialError(faces.material)

  const mesh = CreateBox('card', { width, height, depth }, scene)
  mesh.id = id

  // because planes are in 2-D, collisions with other meshes could be tricky.
  // wraps the plane with an invisible box. Box will take rays and pick operations.
  let visibility = 0
  Object.defineProperty(mesh, 'visibility', {
    get() {
      return visibility
    },
    set(value) {
      faces.visibility = value
    }
  })
  faces.rotate(Axis.X, Math.PI * 0.5)
  faces.isPickable = false
  faces.parent = mesh

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

  faces.overlayColor = new Color3(0, 0.8, 0)
  faces.overlayAlpha = 0.2
  Object.defineProperty(mesh, 'renderOverlay', {
    get() {
      return faces.renderOverlay
    },
    set(value) {
      faces.renderOverlay = value
    }
  })

  registerBehaviors(mesh, behaviorStates)

  controlManager.registerControlable(mesh)
  return mesh
}
