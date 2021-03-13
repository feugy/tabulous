import Babylon from 'babylonjs'
const { Vector3 } = Babylon

export function screenToGround(scene, { x, y }) {
  return scene.createPickingRay(x, y).intersectsAxis('y')
}

export function center3({ x: xA, z: zA }, { x: xB, z: zB }, y = 0) {
  return new Vector3((xA + xB) * 0.5, y, (zA + zB) * 0.5)
}
