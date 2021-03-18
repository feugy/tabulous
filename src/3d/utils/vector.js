import Babylon from 'babylonjs'
const { Matrix, Vector3 } = Babylon

export function screenToGround(scene, { x, y }) {
  return scene.createPickingRay(x, y).intersectsAxis('y')
}

export function groundToScreen(point, scene) {
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

export function center3({ x: xA, z: zA }, { x: xB, z: zB }, y = 0) {
  return new Vector3((xA + xB) * 0.5, y, (zA + zB) * 0.5)
}
