import { ArcRotateCamera, Vector3 } from '@babylonjs/core'

export function createCamera({
  minX = -38,
  maxX = 38,
  minZ = -20,
  maxZ = 20
} = {}) {
  const camera = new ArcRotateCamera(
    'camera',
    -Math.PI / 2,
    0,
    15,
    new Vector3(0, 0, 0)
  )
  camera.allowUpsideDown = false
  camera.wheelDeltaPercentage = 0.01
  camera.upperBetaLimit = Math.PI / 2.5
  camera.lowerBetaLimit = 0
  camera.lowerRadiusLimit = 10
  camera.upperRadiusLimit = 75
  camera.panningSensibility = 500
  camera.panningAxis = new Vector3(1, 0, 1)

  camera.getScene().registerBeforeRender(() => {
    // ensure that we're always panning on the apprioriate plane (x->z)
    const angle = camera.beta / camera.upperBetaLimit
    camera.panningAxis = new Vector3(1, 1 - angle, angle)
    // cap camera to acceptable boundaries
    const { x, z } = camera.target
    if (x < minX) {
      camera.target.x = minX
    } else if (maxX < x) {
      camera.target.x = maxX
    }
    if (z < minZ) {
      camera.target.z = minZ
    } else if (maxZ < z) {
      camera.target.z = maxZ
    }
  })

  camera.attachControl(true, false, 0)
  return camera
}