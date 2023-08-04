// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/utils/behaviors').SerializedMesh} SerializedMesh
 */

import { Axis } from '@babylonjs/core/Maths/math.axis.js'
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js'
import { CSG } from '@babylonjs/core/Meshes/csg.js'

import { controlManager } from '../managers/control'
import { materialManager } from '../managers/material'
import { registerBehaviors, serializeBehaviors } from '../utils/behaviors'
import { applyInitialTransform } from '../utils/mesh'

/**
 * Creates a tile with rounded corners.
 * Tiles are boxes, so their position is their center.
 * A tile's texture must have 2 faces, back then front, aligned horizontally.
 * By default tiles have a width and depth of 3 with a border radius of 0.4.
 * @param {Omit<SerializedMesh, 'shape'>} params - token parameters.
 * @param {Scene} scene - scene for the created mesh.
 * @returns {Mesh} the created tile mesh.
 */
export function createRoundedTile(
  {
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
    transform = undefined,
    ...behaviorStates
  },
  scene
) {
  const tileMesh = CreateBox(
    'roundedTile',
    {
      width,
      height,
      depth,
      faceUV: faceUV.map(components => Vector4.FromArray(components)),
      faceColors: [],
      wrap: true
    },
    scene
  )
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
  const mesh = tileCSG.toMesh(id, undefined, scene)
  mesh.name = 'roundedTile'
  materialManager.configure(mesh, texture)
  applyInitialTransform(mesh, transform)
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.isPickable = false
  mesh.isHittable = true
  tileMesh.dispose(false, true)

  mesh.metadata = {
    serialize: () => ({
      shape: /** @type {'roundedTile'} */ (mesh.name),
      id,
      x: mesh.absolutePosition.x,
      y: mesh.absolutePosition.y,
      z: mesh.absolutePosition.z,
      width,
      height,
      depth,
      borderRadius,
      texture,
      faceUV,
      transform,
      ...serializeBehaviors(mesh.behaviors)
    })
  }

  registerBehaviors(mesh, behaviorStates)

  controlManager.registerControlable(mesh)
  return mesh
}

/**
 * @param {Required<Pick<SerializedMesh, 'borderRadius'|'width'|'height'|'depth'> & { faceUV: Vector4 }>} cornerParams - corner parameters
 * @param {boolean} isTop  - whether if this corner is on the top or the bottom.
 * @param {boolean} isLeft - whether if this corner is on the left or the right.
 * @returns {CSG} Constructive Solid Geometry built for this corner.
 */
function makeCornerMesh(
  { borderRadius, width, height, depth, faceUV },
  isTop,
  isLeft
) {
  const cyclinderMesh = CreateCylinder('cylinder', {
    diameter: borderRadius,
    height,
    faceUV: [faceUV, faceUV, faceUV]
  })
  cyclinderMesh.position.x += (isLeft ? -1 : 1) * (width - borderRadius) * 0.5
  cyclinderMesh.position.z += (isTop ? 1 : -1) * (depth - borderRadius) * 0.5

  const cornerWidth = borderRadius * 0.7
  const cornerMesh = CreateBox('corner', {
    width: cornerWidth,
    depth: cornerWidth,
    height
  })
  cornerMesh.position.x += (isLeft ? -1 : 1) * width * 0.5
  cornerMesh.position.z += (isTop ? 1 : -1) * depth * 0.5
  cornerMesh.rotate(Axis.Y, Math.PI * 0.25)
  const cornerCSG = CSG.FromMesh(cornerMesh).subtract(
    CSG.FromMesh(cyclinderMesh)
  )
  cornerMesh.dispose(false, true)
  cyclinderMesh.dispose(false, true)
  return cornerCSG
}
