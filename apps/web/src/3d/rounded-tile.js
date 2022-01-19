import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Axis } from '@babylonjs/core/Maths/math.axis'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector'
import { CSG } from '@babylonjs/core/Meshes/csg'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { controlManager } from './managers'
import {
  adaptTexture,
  attachMaterialError,
  registerBehaviors,
  serializeBehaviors
} from './utils'

function makeCornerMesh(
  { borderRadius, width, height, depth, faceUV },
  top,
  left
) {
  const cyclinderMesh = CreateCylinder('cylinder', {
    diameter: borderRadius,
    height,
    faceUV: [faceUV, faceUV, faceUV]
  })
  cyclinderMesh.position.x += (left ? -1 : 1) * (width - borderRadius) * 0.5
  cyclinderMesh.position.z += (top ? 1 : -1) * (depth - borderRadius) * 0.5

  const cornerWidth = borderRadius * 0.7
  const cornerMesh = CreateBox('corner', {
    width: cornerWidth,
    depth: cornerWidth,
    height
  })
  cornerMesh.position.x += (left ? -1 : 1) * width * 0.5
  cornerMesh.position.z += (top ? 1 : -1) * depth * 0.5
  cornerMesh.rotate(Axis.Y, Math.PI * 0.25)
  const cornerCSG = CSG.FromMesh(cornerMesh).subtract(
    CSG.FromMesh(cyclinderMesh)
  )
  cornerMesh.dispose()
  cyclinderMesh.dispose()
  return cornerCSG
}

/**
 * Creates a tile with rounded corners.
 * Tiles are boxes, so their position is their center.
 * A tile's texture must have 2 faces, back then front, aligned horizontally.
 * @param {object} params - tile parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.id - tile's unique id.
 * @param {string} params.texture - tile's texture url.
 * @param {number[][]} params.faceUV? - up to 6 face UV (Vector4 components), to map texture on the tile.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {number} params.borderRadius? - radius applied to each corner.
 * @param {number} params.width? - tile's width (X axis).
 * @param {number} params.height? - tile's height (Y axis).
 * @param {number} params.depth? - tile's depth (Z axis).
 * @returns {import('@babylonjs/core').Mesh} the created tile mesh.
 */
export function createRoundedTile({
  id,
  x = 0,
  z = 0,
  y = 0,
  width = 3,
  height = 0.05,
  depth = 3,
  borderRadius = 0.4,
  texture,
  faceUV = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0.5, 1, 0, 0],
    [0.5, 0, 1, 1]
  ],
  ...behaviorStates
} = {}) {
  const tileMesh = CreateBox('roundedTile', {
    width,
    height,
    depth,
    faceUV: faceUV.map(components => Vector4.FromArray(components)),
    faceColors: [],
    wrap: true
  })
  const tileCSG = CSG.FromMesh(tileMesh)
  const cornerParams = {
    faceUV: Vector4.FromArray(faceUV[0]),
    borderRadius,
    width,
    height,
    depth
  }
  tileCSG.subtractInPlace(makeCornerMesh(cornerParams, true, true))
  tileCSG.subtractInPlace(makeCornerMesh(cornerParams, true, false))
  tileCSG.subtractInPlace(makeCornerMesh(cornerParams, false, true))
  tileCSG.subtractInPlace(makeCornerMesh(cornerParams, false, false))
  const tile = tileCSG.toMesh('roundedTile')
  tile.id = id
  tileMesh.dispose()

  tile.material = new StandardMaterial(id)
  tile.material.diffuseTexture = new Texture(adaptTexture(texture))
  tile.material.diffuseTexture.hasAlpha = true
  tile.material.freeze()
  attachMaterialError(tile.material)

  tile.receiveShadows = true
  tile.setAbsolutePosition(new Vector3(x, y, z))
  tile.isPickable = false

  tile.metadata = {
    serialize: () => ({
      shape: tile.name,
      id,
      x: tile.position.x,
      y: tile.position.y,
      z: tile.position.z,
      width,
      height,
      depth,
      borderRadius,
      texture,
      faceUV,
      ...serializeBehaviors(tile.behaviors)
    })
  }

  tile.overlayColor = new Color3(0, 0.8, 0)
  tile.overlayAlpha = 0.2

  registerBehaviors(tile, behaviorStates)

  controlManager.registerControlable(tile)
  return tile
}
