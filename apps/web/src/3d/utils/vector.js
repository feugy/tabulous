import { Matrix, Vector3 } from '@babylonjs/core'

let table

/**
 * @typedef {object} ScreenPosition position on screen (2D, DOM):
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
  if (!table || table.isDisposed) {
    table = scene.getMeshById('table')
  }
  return table ? scene.createPickingRay(x, y).intersectsMesh(table).hit : false
}

/**
 * Returns screen coordinate of a given mesh.
 * @param {import('@babylonjs/core').Mesh} mesh - the tested mesh
 * @returns {ScreenPosition|null} this mesh's screen position
 */
export function getMeshScreenPosition(mesh) {
  if (!mesh || !mesh.getScene()?.activeCamera) {
    return null
  }
  const scene = mesh.getScene()
  const engine = scene.getEngine()
  const { x, y } = Vector3.Project(
    mesh.absolutePosition,
    Matrix.Identity(),
    scene.getTransformMatrix(),
    scene.activeCamera.viewport.toGlobal(
      engine.getRenderWidth(),
      engine.getRenderHeight()
    )
  )
  return { x, y }
}
