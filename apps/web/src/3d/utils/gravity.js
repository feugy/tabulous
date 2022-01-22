import { Ray } from '@babylonjs/core/Culling/ray'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { getHeight } from './mesh'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

const logger = makeLogger('gravity')

const rayLength = 30
const down = Vector3.Down()

function findBelow(mesh, predicate) {
  const over = new Map()
  const { boundingBox } = mesh.getBoundingInfo()

  const vertices = [mesh.absolutePosition]
  for (const vertex of boundingBox.vectorsWorld) {
    if (vertex.y <= vertices[0].y) {
      vertices.push(vertex)
    }
  }

  const scene = mesh.getScene()
  for (const vertex of vertices) {
    const hit = scene.pickWithRay(new Ray(vertex, down, rayLength), predicate)
    if (hit.pickedMesh) {
      const count = over.get(hit.pickedMesh) || 0
      over.set(hit.pickedMesh, count + 1)
    }
  }
  return over
}

/**
 * Computes the Y coordinate to assign to 'mesh' so it goes above 'other', considering their heights.
 * Does not modifies any coordinate.
 * @param {import('@babel/core').Mesh} mesh - positionned over the other mesh.
 * @param {import('@babel/core').Mesh} other - foundation to put the mesh on.
 * @returns {number} resulting Y coordinate.
 */
export function computeYAbove(mesh, other) {
  return (
    other.absolutePosition.y +
    (getHeight(other) + getHeight(mesh)) * 0.5 +
    0.001
  )
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
  const over = findBelow(mesh, other => other.isPickable && other !== mesh)
  let y = getHeight(mesh) * 0.5
  if (over.size) {
    const ordered = sortByElevation(over.keys(), true)
    y = computeYAbove(mesh, ordered[0])
    logger.info(
      { ordered, mesh },
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
 * Indicates when a mesh is hovering another one (partial overlap supported).
 * Can apply a scale factor to the target.
 * Does not modifies any coordinate.
 * @param {import('@babel/core').Mesh} mesh - checked mesh.
 * @param {import('@babel/core').Mesh} target - other mesh.
 * @param {number} [scale=1] - scale applied to the target.
 * @returns {boolean} true when mesh is hovering the target.
 */
export function isAbove(mesh, target, scale = 1) {
  const originalScale = target.scaling.clone()
  target.scaling.addInPlace(new Vector3(scale, scale, scale))
  target.computeWorldMatrix(true)

  const over = findBelow(mesh, other => other === target)
  target.scaling.copyFrom(originalScale)
  target.computeWorldMatrix(true)
  return over.get(target) >= 4
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
