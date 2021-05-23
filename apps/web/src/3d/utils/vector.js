import { Matrix, Vector3 } from '@babylonjs/core'

let table

/**
 * Converts a screen position (2D, DOM) into a point on the ground (3D, scene).
 * Useful to know where on the ground a player has clicked.
 * @param {import('@babylonjs/core').Scene} scene - current scene.
 * @param {object} position - screen position, including:
 * @param {number} position.x - x coordinate.
 * @param {number} position.y - y coordinate.
 * @returns {Vector3} 3D point on the ground plane (Y axis) for this position
 */
export function screenToGround(scene, { x, y }) {
  return scene.createPickingRay(x, y).intersectsAxis('y')
}

export function isAboveTable(scene, { x, y }) {
  if (!table || table.isDisposed) {
    table = scene.getMeshByID('table')
  }
  return scene.createPickingRay(x, y).intersectsMesh(table).hit
}

export function groundToScreen(point, scene) {
  if (!scene?.activeCamera) {
    return null
  }
  const engine = scene.getEngine()
  const { x, y } = Vector3.Project(
    point,
    Matrix.Identity(),
    scene.getTransformMatrix(),
    scene.activeCamera.viewport.toGlobal(
      engine.getRenderWidth(),
      engine.getRenderHeight()
    )
  )
  return { x, y }
}
