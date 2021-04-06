import { Matrix, Vector3 } from '@babylonjs/core'

let table

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
