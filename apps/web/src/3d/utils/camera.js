import { Animation, Vector3 } from '@babylonjs/core'

const frameRate = 30
const cameraAnimationDuration = 1

const positionAnimation = new Animation(
  'moveCameraPosition',
  'position',
  frameRate,
  Animation.ANIMATIONTYPE_VECTOR3,
  Animation.ANIMATIONLOOPMODE_CONSTANT
)

const targetAnimation = new Animation(
  'moveCameraTarget',
  'target',
  frameRate,
  Animation.ANIMATIONTYPE_VECTOR3,
  Animation.ANIMATIONLOOPMODE_CONSTANT
)

/**
 * @typedef {object} CameraState
 * @property {number[]} position - Vector3 component of the camera current position.
 * @property {number[]} target - Vector3 component of the camera target point.
 */

/**
 * Returns the engine active camera.
 * @param {import('@babylonjs/core').Engine} engine - 3D engine.
 * @returns {import('@babylonjs/core').Camera} the active camera, or null.
 */
export function getCamera(engine) {
  return engine?.scenes?.[0]?.activeCamera ?? null
}

/**
 * Saves the active camera state (its target and position).
 * @param {import('@babylonjs/core').Engine} engine - 3D engine.
 * @returns {CameraState} the current camera state.
 */
export function saveCamera(engine) {
  const camera = getCamera(engine)
  return camera
    ? { target: camera.target.asArray(), position: camera.position.asArray() }
    : null
}

/**
 * Gracefully moves the active camera to a previously saved state
 * Returns on completion.
 * @async
 * @param {import('@babylonjs/core').Engine} engine - 3D engine.
 * @param {CameraState} state - the restored camera state.
 */
export async function restoreCamera(engine, { position, target }) {
  const camera = getCamera(engine)
  if (camera) {
    const lastFrame = Math.round(frameRate * cameraAnimationDuration)
    await new Promise(resolve => {
      targetAnimation.setKeys([
        { frame: 0, value: camera.target },
        { frame: lastFrame / 2, value: Vector3.FromArray(target) }
      ])
      positionAnimation.setKeys([
        { frame: lastFrame / 2, value: camera.position },
        { frame: lastFrame, value: Vector3.FromArray(position) }
      ])

      camera
        .getScene()
        .beginDirectAnimation(
          camera,
          [targetAnimation, positionAnimation],
          0,
          lastFrame,
          false,
          1,
          resolve()
        )
    })
  }
}
