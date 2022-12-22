import { Ray } from '@babylonjs/core/Culling/ray.js'
import {
  Matrix,
  Quaternion,
  Vector3
} from '@babylonjs/core/Maths/math.vector.js'

let table

/**
 * @typedef {object} ScreenPosition position on screen (2D, DOM)
 * @property {number} x - x coordinate.
 * @property {number} y - y coordinate.
 */

/**
 * Converts a screen position into a point on the ground (3D, scene).
 * Useful to know where on the ground a player has clicked.
 * @param {import('@babylonjs/core').Scene} scene - current scene.
 * @param {ScreenPosition} position - screen position.
 * @returns {Vector3} 3D point on the ground plane (Y axis) for this position.
 */
export function screenToGround(scene, { x, y }) {
  return scene.createPickingRay(x, y).intersectsAxis('y')
}

/**
 * Indicates whether a screen position (2D, DOM) is above the table mesh.
 * @param {import('@babylonjs/core').Scene} scene - current scene.
 * @param {ScreenPosition} position - screen position.
 * @returns {boolean} true if the point is within the table area, false otherwise.
 */
export function isAboveTable(scene, { x, y }) {
  /* istanbul ignore next */
  if (!table || table.isDisposed) {
    table = scene.getMeshById('table')
  }
  return table ? scene.createPickingRay(x, y).intersectsMesh(table).hit : false
}

/**
 * Indicates whether a world position (3D, scene) is above the table mesh.
 * @param {import('@babylonjs/core').Scene} scene - current scene.
 * @param {Vector3} position - 3D position.
 * @returns {boolean} true if the point is within the table area, false otherwise.
 */
export function isPositionAboveTable(scene, position) {
  /* istanbul ignore next */
  if (!table || table.isDisposed) {
    table = scene.getMeshById('table')
  }
  return table
    ? new Ray(position, new Vector3(position.x, -1, position.z)).intersectsMesh(
        table
      ).hit
    : false
}

/**
 * Returns screen coordinate of a given mesh.
 * @param {import('@babylonjs/core').Mesh} mesh - the tested mesh.
 * @param {number[]} [offset = [0, 0, 0]] - optional offset (3D coordinates) applied.
 * @returns {ScreenPosition|null} this mesh's screen position.
 */
export function getMeshScreenPosition(mesh, offset = [0, 0, 0]) {
  if (!mesh || !mesh.getScene()?.activeCamera) {
    return null
  }
  const position = mesh.getAbsolutePosition().clone()
  return getScreenPosition(
    mesh.getScene(),
    position.addInPlaceFromFloats(...offset)
  )
}

/**
 * Returns screen coordinate of a 3D position given a scene's active camera.
 * @param {import('@babylonjs/core').Scene} scene - current scene.
 * @param {Vector3} position - 3D position.
 * @returns {ScreenPosition} the corresponding screen position
 */
export function getScreenPosition(scene, position) {
  const engine = scene.getEngine()
  const { x, y } = Vector3.Project(
    position,
    Matrix.Identity(),
    scene.getTransformMatrix(),
    scene.activeCamera.viewport.toGlobal(
      engine.getRenderWidth(),
      engine.getRenderHeight()
    )
  )
  return { x, y }
}

/**
 * Converts a position in world space into a given mesh's local space.
 * @param {Vector3} absolutePosition - absolute position to convert.
 * @param {import('@babylonjs/core').Mesh} mesh - mesh into which position is converted.
 * @returns {Vector3} the converted position in mesh's local space.
 */
export function convertToLocal(absolutePosition, mesh) {
  if (!mesh.parent) {
    return absolutePosition.clone()
  }
  const matrix = new Matrix()
  mesh.parent.computeWorldMatrix(true).invertToRef(matrix)
  return Vector3.TransformCoordinates(absolutePosition, matrix)
}

/**
 * Returns mesh local rotation in world space.
 * @param {import('@babylonjs/core').Mesh} mesh - related mesh.
 * @returns {Vector3} absolute rotation (Euler angles).
 */
export function getAbsoluteRotation(mesh) {
  const rotation = Quaternion.Identity()
  mesh
    .computeWorldMatrix(true)
    .decompose(Vector3.Zero(), rotation, Vector3.Zero())
  return rotation.toEulerAngles()
}
