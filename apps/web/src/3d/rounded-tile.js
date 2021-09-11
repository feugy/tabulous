import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Axis } from '@babylonjs/core/Maths/math.axis'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector'
import { CSG } from '@babylonjs/core/Meshes/csg'
import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
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

const side = new Vector4(0.2, 0, 0.3, 1)

function makeCornerMesh(
  { borderRadius, width, height, depth, borderColor },
  top,
  left
) {
  const color = Color4.FromArray(borderColor)

  const cyclinderMesh = CylinderBuilder.CreateCylinder('cylinder', {
    diameter: borderRadius,
    height: depth,
    faceColors: [color, color, color]
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
 * Creates a tile with rounded corners.
 * Tiles are boxes, so their position is their center (half their depth).
 * A tile has the following behaviors:
 * - movable
 * - detailable
 * - flippable
 * - rotable
 * - stackable (the entire tile is a drop target)
 * A tile's texture must have 2 faces, back then front, aligned horizontally.
 * Edges have solid color (borderColor).
 * @param {object} params - tile parameters, including (all other properties will be passed to the created mesh):
 * @param {string} params.id - tile's unique id.
 * @param {string} params.texture - tile's texture url.
 * @param {import('./utils').ImageDefs} params.images - detailed images for this tile.
 * @param {number} params.x? - initial position along the X axis.
 * @param {number} params.y? - initial position along the Y axis.
 * @param {number} params.z? - initial position along the Z axis.
 * @param {number} params.borderRadius? - radius applied to each corner.
 * @param {number[]} params.borderColor? - Color4's components used as edge color.
 * @param {number} params.width? - tile's width (X axis).
 * @param {number} params.height? - tile's height (Z axis).
 * @param {number} params.depth? - tile's depth (Y axis).
 * @param {boolean} params.isFlipped? - initial flip state (face visible).
 * @param {number} params.flipDuration? - flip duration (in milliseconds).
 * @param {number} params.angle? - initial rotation angle (top above), in radians.
 * @param {number} params.rotateDuration? - rotation duration (in milliseconds).
 * @param {number} params.snapDistance? - distance bellow which the tile automatically snaps to nearest position.
 * @param {number} params.moveDuration? - automatic move duration (in milliseconds), when snapping.
 * @returns {import('@babylonjs/core').Mesh} the created tile mesh.
 */
export function createRoundedTile({
  id,
  x = 0,
  z = 0,
  y = 0,
  width = 3,
  height = 3,
  depth = 0.05,
  borderRadius = 0.4,
  borderColor = [0, 0, 0, 1],
  texture,
  isFlipped = false,
  angle = 0,
  flipDuration = 500,
  rotateDuration = 200,
  moveDuration = 100,
  snapDistance = 0.25,
  images,
  ...tileProps
} = {}) {
  const faceUV = [
    side,
    side,
    side,
    side,
    new Vector4(0.5, 1, 0, 0),
    new Vector4(0.5, 0, 1, 1)
  ]
  const color = Color4.FromArray(borderColor)
  const faceColors = [color, color, color, color, undefined, undefined]
  const tileMesh = BoxBuilder.CreateBox('rounded-tile', {
    width,
    height: depth,
    depth: height,
    faceUV,
    faceColors,
    wrap: true
  })
  const tileCSG = CSG.FromMesh(tileMesh)
  const cornerParams = { borderColor, borderRadius, width, height, depth }
  tileCSG.subtractInPlace(makeCornerMesh(cornerParams, true, true))
  tileCSG.subtractInPlace(makeCornerMesh(cornerParams, true, false))
  tileCSG.subtractInPlace(makeCornerMesh(cornerParams, false, true))
  tileCSG.subtractInPlace(makeCornerMesh(cornerParams, false, false))
  const tile = tileCSG.toMesh('rounded-tile')
  tile.id = id
  tileMesh.dispose()

  tile.material = new StandardMaterial(id)
  tile.material.diffuseTexture = new Texture(adaptTexture(texture))
  tile.material.diffuseTexture.hasAlpha = true
  tile.material.freeze()
  attachMaterialError(tile.material)

  tile.receiveShadows = true
  tile.setAbsolutePosition(new Vector3(x, y, z))
  Object.assign(tile, tileProps)

  tile.metadata = {
    images,
    serialize: () => ({
      ...tileProps,
      id,
      x: tile.position.x,
      y: tile.position.y,
      z: tile.position.z,
      width,
      height,
      depth,
      borderColor,
      borderRadius,
      texture,
      images,
      ...flipBehavior.serialize(),
      ...rotateBehavior.serialize(),
      ...stackBehavior.serialize()
    })
  }

  tile.overlayColor = new Color3(0, 0.8, 0)
  tile.overlayAlpha = 0.2

  tile.addBehavior(new DetailBehavior(), true)

  const dragKind = 'tile'
  tile.addBehavior(
    new MoveBehavior({ moveDuration, snapDistance, dragKind }),
    true
  )

  const flipBehavior = new FlipBehavior({ duration: flipDuration, isFlipped })
  tile.addBehavior(flipBehavior, true)

  const rotateBehavior = new RotateBehavior({ duration: rotateDuration, angle })
  tile.addBehavior(rotateBehavior, true)

  const stackBehavior = new StackBehavior({ moveDuration })
  const dropZone = BoxBuilder.CreateBox('drop-zone', {
    width: width * 1.03,
    height: depth + 0.01,
    depth: height * 1.03
  })
  dropZone.parent = tile
  stackBehavior.addZone(dropZone, 0.3, [dragKind])
  tile.addBehavior(stackBehavior, true)

  controlManager.registerControlable(tile)
  tile.onDisposeObservable.addOnce(() =>
    controlManager.unregisterControlable(tile)
  )
  return tile
}
