// @ts-check
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import { makeLogger } from '../../utils/logger'
import {
  buildEnclosedCircle,
  buildGroundRectangle,
  intersectCircles,
  intersectRectangles,
  intersectRectangleWithCircle
} from '../../utils/math'

/** @typedef {import('@src/utils/math').Rectangle | import('@src/utils/math').Circle} Geometry */

const logger = makeLogger('gravity')

/**
 * Gap between meshes when computing altitude above specific positions.
 */
export const altitudeGap = 0.01

/**
 * Return the altitude of a mesh center if it was lying on the ground
 * @template {import('@babylonjs/core').AbstractMesh} T
 * @param {T} mesh - dested mesh.
 * @returns resulting y coordinage.
 */
export function getGroundAltitude(mesh) {
  return -mesh.getBoundingInfo().minimum.y
}

/**
 * Returns the absolute altitude (Y axis) above a given mesh, including minimum spacing.
 * @template {import('@babylonjs/core').AbstractMesh} T
 * @param {T} mesh - related mesh.
 * @returns resulting Y coordinate.
 */
export function getAltitudeAbove(mesh) {
  return mesh.getBoundingInfo().boundingBox.maximumWorld.y + altitudeGap
}

/**
 * Computes the Y coordinate to assign to 'mesh' so it goes above 'other', considering their heights.
 * Does not modifies any coordinate.
 * @template {import('@babylonjs/core').AbstractMesh} T
 * @param {T} meshBelow - foundation to put the mesh on.
 * @param {T} meshAbove - positionned over the other mesh.
 * @returns resulting Y coordinate.
 */
export function getCenterAltitudeAbove(meshBelow, meshAbove) {
  meshBelow.computeWorldMatrix(true)
  return getAltitudeAbove(meshBelow) + getGroundAltitude(meshAbove)
}

/**
 * Changes a mesh's Y coordinate so it lies on mesh below, or on the ground.
 * It'll check all other meshes in the same scene to identify the ones below (partial overlap is supported).
 * Does not run any animation, and change its absolute position.
 * @param {import('@babylonjs/core').Mesh} mesh - applied mesh.
 * @returns the mesh's new absolute position
 */
export function applyGravity(mesh) {
  mesh.setAbsolutePosition(getAltitudeAfterGravity(mesh))
  return mesh.absolutePosition
}

/**
 * Compute a mesh's Y coordinate so it lies on mesh below, or on the ground.
 * It'll check all other meshes in the same scene to identify the ones below (partial overlap is supported).
 * Does not alter any mesh
 * @param {import('@babylonjs/core').Mesh} mesh - tested mesh.
 * @returns new vector.
 */
export function getAltitudeAfterGravity(mesh) {
  logger.info(
    { y: mesh.absolutePosition.y, mesh },
    `gravity for ${mesh.id} y: ${mesh.absolutePosition.y}`
  )
  const below = findBelow(
    mesh,
    mesh.getScene().meshes.filter(other => other.isHittable && other !== mesh)
  )

  let y = getGroundAltitude(mesh)
  if (below.length) {
    const ordered = sortByElevation(below, true)
    y = getCenterAltitudeAbove(ordered[0], mesh)
    logger.info(
      { ordered, mesh, y },
      `${mesh.id} is above ${ordered.map(({ id }) => id)}`
    )
  }
  const { x, z } = mesh.absolutePosition
  return new Vector3(x, y, z)
}

/**
 * Indicates when a mesh is hovering another one.
 * Does not modifies any coordinates.
 * @template {import('@babylonjs/core').AbstractMesh} T
 * @param {T} mesh - checked mesh.
 * @param {T} target - other mesh.
 * @returns true when mesh is hovering the target.
 */
export function isAbove(mesh, target) {
  return findBelow(mesh, [target]).length === 1
}

/**
 * Sort meshes by elevation.
 * This will guarantee a proper gravity application when running operations (moves, flips...) in parallel.
 * @template {import('@babylonjs/core').AbstractMesh} T
 * @param {Iterable<T>} [meshes] - array of meshes to order.
 * @param {boolean} [highestFirst = false] - false to return highest first.
 * @returns sorted array.
 */
export function sortByElevation(meshes, highestFirst = false) {
  return [...(meshes ?? [])].sort((a, b) =>
    highestFirst
      ? b.absolutePosition.y - a.absolutePosition.y
      : a.absolutePosition.y - b.absolutePosition.y
  )
}

/**
 * @template {import('@babylonjs/core').AbstractMesh} T
 * @param {T} mesh - reference mesh.
 * @param {T[]} candidates - list of candidate meshes to consider.
 * @returns candidate meshes bellow the reference mesh.
 */
function findBelow(mesh, candidates) {
  const results = []
  mesh.computeWorldMatrix(true)
  const { boundingBox } = mesh.getBoundingInfo()
  const geometry = buildGeometry(mesh, boundingBox)
  for (const other of candidates) {
    other.computeWorldMatrix(true)
    const { boundingBox: otherBox } = other.getBoundingInfo()
    if (isGloballyBelow(boundingBox, otherBox)) {
      if (intersectGeometries(geometry, buildGeometry(other, otherBox))) {
        results.push(other)
      }
    }
  }
  return results
}

/**
 * @param {Geometry} geometryA - first considered geometry.
 * @param {Geometry} geometryB - second considered geometry.
 * @returns whether these geometry instersect.
 */
function intersectGeometries(geometryA, geometryB) {
  const circleA = 'center' in geometryA ? geometryA : null
  const circleB = 'center' in geometryB ? geometryB : null
  const rectangleA = 'min' in geometryA ? geometryA : null
  const rectangleB = 'min' in geometryB ? geometryB : null
  if (circleA && circleB) {
    return intersectCircles(circleA, circleB)
  }
  if (rectangleA && rectangleB) {
    return intersectRectangles(rectangleA, rectangleB)
  }
  return intersectRectangleWithCircle(
    rectangleA
      ? rectangleA
      : /** @type {import('@src/utils/math').Rectangle} */ (rectangleB),
    circleA
      ? circleA
      : /** @type {import('@src/utils/math').Circle} */ (circleB)
  )
}

/**
 * @template {import('@babylonjs/core').AbstractMesh} T
 * @param {T} mesh - reference mesh.
 * @param {import('@babylonjs/core').BoundingBox} boundingBox - bounding box to build geometry for.
 * @returns bounding box's geomertry object.
 */
function buildGeometry(mesh, boundingBox) {
  const rectangle = buildGroundRectangle(boundingBox)
  return mesh.isCylindric ? buildEnclosedCircle(rectangle) : rectangle
}

/**
 * @param {import('@babylonjs/core').BoundingBox} reference - reference bounding box.
 * @param {import('@babylonjs/core').BoundingBox} tested - tested bounding box.
 * @returns whether tested bounding box is below the reference.
 */
function isGloballyBelow(reference, tested) {
  return tested.maximumWorld.y <= reference.minimumWorld.y
}
