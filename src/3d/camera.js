import Babylon from 'babylonjs'
const { ArcRotateCamera, Vector3 } = Babylon

export function createCamera() {
  const camera = new ArcRotateCamera(
    'camera',
    -Math.PI / 2,
    0,
    15,
    new Vector3(0, 0, 0)
  )
  camera.upperBetaLimit = Math.PI / 2.5
  camera.lowerBetaLimit = -Math.PI / 2.5
  camera.lowerRadiusLimit = 5
  camera.upperRadiusLimit = 50
  camera.panningSensibility = 500

  camera.attachControl(true, false, 0)
  return camera
}
