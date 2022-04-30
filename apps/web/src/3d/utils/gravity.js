import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { getDimensions } from './mesh'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'
import {
  buildEnclosedCircle,
  buildGroundRectangle,
  intersectRectangles,
  intersectCircles,
  intersectCorners
} from '../../utils/math'

const logger = makeLogger('gravity')

/**
 * Returns the absolute altitude (Y axis) above a given mesh, including minimum spacing.
 * @param {import('@babel/core').Mesh} mesh - related mesh.
 * @returns {number} resulting Y coordinate.
 */
export function getAltitudeAbove(mesh) {
  return mesh.absolutePosition.y + getDimensions(mesh).height * 0.5 + 0.001
}

/**
 * Computes the Y coordinate to assign to 'mesh' so it goes above 'other', considering their heights.
 * Does not modifies any coordinate.
 * @param {import('@babel/core').Mesh} meshBelow - foundation to put the mesh on.
 * @param {import('@babel/core').Mesh} meshAbove - positionned over the other mesh.
 * @returns {number} resulting Y coordinate.
 */
export function getCenterAltitudeAbove(meshBelow, meshAbove) {
  return getAltitudeAbove(meshBelow) + getDimensions(meshAbove).height * 0.5
}

/**
 * Changes a mesh's Y coordinate so it lies on mesh below, or on the ground.
 * It'll check all other meshes in the same scene to identify the ones below (partial overlap is supported).
 * Does not run any animation, and change its absolute position.
 * @param {import('@babel/core').Mesh} mesh - applied mesh.
 * @returns {Vector3} the mesh's new absolute position
 */
export function applyGravity(mesh) {
  logger.info(
    { y: mesh.absolutePosition.y, mesh },
    `gravity for ${mesh.id} y: ${mesh.absolutePosition.y}`
  )
  mesh.computeWorldMatrix(true)
  const below = findBelow(
    mesh,
    mesh.getScene().meshes.filter(other => other.isPickable && other !== mesh)
  )
  let y = getDimensions(mesh).height * 0.5
  if (below.length) {
    const ordered = sortByElevation(below, true)
    y = getCenterAltitudeAbove(ordered[0], mesh)
    logger.info(
      { ordered, mesh, y },
      `${mesh.id} is above ${ordered.map(({ id }) => id)}`
    )
  }
  logger.info({ y, mesh }, `${mesh.id} assigned to y: ${y}`)
  const { x, z } = mesh.absolutePosition
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  mesh.computeWorldMatrix(true)
  return mesh.absolutePosition
}

/**
 * Indicates when a mesh is hovering another one.
 * Can apply a scale factor to the target: scale bellow 1 means smaller target.
 * Does not modifies any coordinates.
 * @param {import('@babel/core').Mesh} mesh - checked mesh.
 * @param {import('@babel/core').Mesh} target - other mesh.
 * @param {number} [scale=1] - scale applied to the target.
 * @returns {boolean} true when mesh is hovering the target.
 */
export function isAbove(mesh, target, scale = 1) {
  const originalScale = target.scaling.clone()
  target.scaling = new Vector3(scale, scale, scale)
  target.computeWorldMatrix(true)

  const isOver = findBelow(mesh, [target]).length === 1
  target.scaling.copyFrom(originalScale)
  target.computeWorldMatrix(true)
  return isOver
}

/**
 * Sort meshes by elevation.
 * This will guarantee a proper gravity application when running operations (moves, flips...) in parallel.
 * @param {import('@babel/core').Mesh[]} meshes - array of meshes to order.
 * @param {boolean} [highestFirst = false] - false to return highest first.
 * @return {import('@babel/core').Mesh[]} sorted array.
 */
export function sortByElevation(meshes, highestFirst = false) {
  return [...(meshes ?? [])].sort((a, b) =>
    highestFirst
      ? b.absolutePosition.y - a.absolutePosition.y
      : a.absolutePosition.y - b.absolutePosition.y
  )
}

function findBelow(mesh, candidates) {
  const results = []
  const { boundingBox } = mesh.getBoundingInfo()
  const geometries = buildGeometries(mesh, boundingBox)

  for (const other of candidates) {
    const { boundingBox: otherBox } = other.getBoundingInfo()
    if (isGloballyBelow(boundingBox, otherBox)) {
      if (intersectGeometries(geometries, buildGeometries(other, otherBox))) {
        results.push(other)
      }
    }
  }
  return results
}

function intersectGeometries([geometryA, rectangleA], [geometryB, rectangleB]) {
  if (geometryA.center && geometryB.center) {
    return intersectCircles(geometryA, geometryB)
  }
  if (geometryA.min && geometryB.min) {
    return intersectRectangles(geometryA, geometryB)
  }
  if (!intersectRectangles(rectangleA, rectangleB)) {
    return false
  }
  return intersectCorners(
    geometryA.circle ? geometryB : geometryA,
    geometryA.circle ? geometryA : geometryB
  )
}

function buildGeometries(mesh, boundingBox) {
  const rectangle = buildGroundRectangle(boundingBox)
  return mesh.isCylindric
    ? [buildEnclosedCircle(rectangle), rectangle]
    : [rectangle, rectangle]
}

function isGloballyBelow(reference, tested) {
  return tested.maximumWorld.y < reference.minimumWorld.y
}
