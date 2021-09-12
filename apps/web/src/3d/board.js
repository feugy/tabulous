import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Axis } from '@babylonjs/core/Maths/math.axis'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector'
import { CSG } from '@babylonjs/core/Meshes/csg'
import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CylinderBuilder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import {
  adaptTexture,
  attachMaterialError,
  registerBehaviors,
  serializeBehaviors
} from './utils'

const side = new Vector4(0.2, 0, 0.3, 1)

function makeCornerMesh({ borderRadius, width, height, depth }, top, left) {
  const cyclinderMesh = CylinderBuilder.CreateCylinder('cylinder', {
    diameter: borderRadius,
    height: depth
  })
  cyclinderMesh.position.x += (left ? -1 : 1) * (width - borderRadius) * 0.5
  cyclinderMesh.position.z += (top ? 1 : -1) * (height - borderRadius) * 0.5

  const cornerWidth = borderRadius * 0.7
  const cornerMesh = BoxBuilder.CreateBox('corner', {
    width: cornerWidth,
    depth: cornerWidth,
    height: depth
  })
  cornerMesh.position.x += (left ? -1 : 1) * width * 0.5
  cornerMesh.position.z += (top ? 1 : -1) * height * 0.5
  cornerMesh.rotate(Axis.Y, Math.PI * 0.25)
  const cornerCSG = CSG.FromMesh(cornerMesh).subtract(
    CSG.FromMesh(cyclinderMesh)
  )
  cornerMesh.dispose()
  cyclinderMesh.dispose()
  return cornerCSG
}

/**
 * Creates a board with rounded corners.
 * Boards are boxes, so their position is their center.
 * A board supports all behaviors.
 * @param {object} params - tile parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.id - board's unique id.
 * @param {string} params.texture - board's texture url.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {number} params.borderRadius? - radius applied to each corner.
 * @param {number} params.width? - tile's width (X axis).
 * @param {number} params.height? - tile's height (Z axis).
 * @param {number} params.depth? - tile's depth (Y axis).
 * @returns {import('@babylonjs/core').Mesh} the created tile mesh.
 */
export function createBoard({
  id,
  x = 0,
  z = 0,
  y = 0,
  width = 3,
  height = 3,
  depth = 0.05,
  texture,
  borderRadius = 0.4,
  ...boardProps
} = {}) {
  const faceUV = [
    side,
    side,
    side,
    side,
    new Vector4(0.5, 1, 0, 0),
    new Vector4(0.5, 0, 1, 1)
  ]
  const boardMesh = BoxBuilder.CreateBox('board', {
    width,
    height: depth,
    depth: height,
    faceUV,
    wrap: true
  })
  const boardCSG = CSG.FromMesh(boardMesh)
  const cornerParams = { borderRadius, width, height, depth }
  boardCSG.subtractInPlace(makeCornerMesh(cornerParams, true, true))
  boardCSG.subtractInPlace(makeCornerMesh(cornerParams, true, false))
  boardCSG.subtractInPlace(makeCornerMesh(cornerParams, false, true))
  boardCSG.subtractInPlace(makeCornerMesh(cornerParams, false, false))
  const board = boardCSG.toMesh('board')
  board.id = id
  boardMesh.dispose()

  board.material = new StandardMaterial(id)
  board.material.diffuseTexture = new Texture(adaptTexture(texture))
  board.material.diffuseTexture.hasAlpha = true
  board.material.freeze()
  attachMaterialError(board.material)

  board.receiveShadows = true
  board.setAbsolutePosition(new Vector3(x, y, z))
  Object.assign(board, boardProps)

  board.metadata = {
    serialize: () => ({
      ...boardProps,
      id,
      x: board.position.x,
      y: board.position.y,
      z: board.position.z,
      width,
      height,
      depth,
      texture,
      borderRadius,
      ...serializeBehaviors(board.behaviors)
    })
  }

  board.overlayColor = new Color3(0, 0.8, 0)
  board.overlayAlpha = 0.2

  registerBehaviors(board, boardProps)

  return board
}
