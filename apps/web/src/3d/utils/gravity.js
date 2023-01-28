import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'

import { makeLogger } from '../../utils/logger'
import {
  buildEnclosedCircle,
  buildGroundRectangle,
  intersectCircles,
  intersectRectangles,
  intersectRectangleWithCircle
} from '../../utils/math'

const logger = makeLogger('gravity')

/** @typedef {import('@babel/core').Mesh} Mesh */

/**
 * Gap between meshes when computing altitude above specific positions.
 */
export const altitudeGap = 0.01

/**
 * Return the altitude of a mesh center if it was lying on the ground
 * @param {Mesh} mesh - dested mesh.
 * @returns {number} resulting y coordinage.
 */
export function getGroundAltitude(mesh) {
  return -mesh.getBoundingInfo().minimum.y
}

/**
 * Returns the absolute altitude (Y axis) above a given mesh, including minimum spacing.
 * @param {Mesh} mesh - related mesh.
 * @returns {number} resulting Y coordinate.
 */
export function getAltitudeAbove(mesh) {
  return mesh.getBoundingInfo().boundingBox.maximumWorld.y + altitudeGap
}

/**
 * Computes the Y coordinate to assign to 'mesh' so it goes above 'other', considering their heights.
 * Does not modifies any coordinate.
 * @param {Mesh} meshBelow - foundation to put the mesh on.
 * @param {Mesh} meshAbove - positionned over the other mesh.
 * @returns {number} resulting Y coordinate.
 */
export function getCenterAltitudeAbove(meshBelow, meshAbove) {
  meshBelow.computeWorldMatrix(true)
  return getAltitudeAbove(meshBelow) + getGroundAltitude(meshAbove)
}

/**
 * Changes a mesh's Y coordinate so it lies on mesh below, or on the ground.
 * It'll check all other meshes in the same scene to identify the ones below (partial overlap is supported).
 * Does not run any animation, and change its absolute position.
 * @param {Mesh} mesh - applied mesh.
 * @returns {Vector3} the mesh's new absolute position
 */
export function applyGravity(mesh) {
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
  logger.info({ y, mesh }, `${mesh.id} assigned to y: ${y}`)
  const { x, z } = mesh.absolutePosition
  mesh.setAbsolutePosition(new Vector3(x, y, z))
  return mesh.absolutePosition
}

/**
 * Indicates when a mesh is hovering another one.
 * Does not modifies any coordinates.
 * @param {Mesh} mesh - checked mesh.
 * @param {Mesh} target - other mesh.
 * @returns {boolean} true when mesh is hovering the target.
 */
export function isAbove(mesh, target) {
  return findBelow(mesh, [target]).length === 1
}

/**
 * Sort meshes by elevation.
 * This will guarantee a proper gravity application when running operations (moves, flips...) in parallel.
 * @param {Mesh[]} meshes - array of meshes to order.
 * @param {boolean} [highestFirst = false] - false to return highest first.
 * @return {Mesh[]} sorted array.
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

function intersectGeometries(geometryA, geometryB) {
  if (geometryA.center && geometryB.center) {
    return intersectCircles(geometryA, geometryB)
  }
  if (geometryA.min && geometryB.min) {
    return intersectRectangles(geometryA, geometryB)
  }
  return intersectRectangleWithCircle(
    geometryA.center ? geometryB : geometryA,
    geometryA.center ? geometryA : geometryB
  )
}

function buildGeometry(mesh, boundingBox) {
  const rectangle = buildGroundRectangle(boundingBox)
  return mesh.isCylindric ? buildEnclosedCircle(rectangle) : rectangle
}

function isGloballyBelow(reference, tested) {
  return tested.maximumWorld.y <= reference.minimumWorld.y
}
