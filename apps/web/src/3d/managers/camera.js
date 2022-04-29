import { Animation } from '@babylonjs/core/Animations/animation'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { FlyCamera } from '@babylonjs/core/Cameras/flyCamera'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Observable } from '@babylonjs/core/Misc/observable'
import { isPositionAboveTable, screenToGround } from '../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

/**
 * @typedef {object} CameraSave camera state save, including:
 * @property {number[]} target - camera locked target, as an array of 3D coordinates.
 * @property {number} alpha - alpha angle, in radian.
 * @property {number} beta - beta angle, in radia.
 * @property {number} elevation - altitude, in 3D coordinate.
 * @property {string} hash - hash to compare saves together.
 */

class CameraManager {
  /**
   * Creates a manager to control the camera:
   * - pan, zoom and rotate
   * - save and restore its position
   * An ArcRotateCamera with no controls nor behaviors is created when initializing the manager.
   * Clears all observers on scene disposal.
   *
   * @property {number} minAngle - minimum camera angle (with x/z plane), in radian
   * @property {TargetCamera} camera? - managed camera.
   * @property {TargetCamera} handSceneCamera? - camera for the hand scene, fixed.
   * @property {CameraSave[]} saves? - list of camera state saves.
   * @property {Observable<CameraSave[]>} onSaveObservable - emits when saving new camera positions.
   * @property {Observable<CameraSave>} onMoveObservable - emits when moving current camera (target, angle or elevation).
   */
  constructor() {
    this.camera = null
    this.handSceneCamera = null
    this.minAngle = 0
    this.saves = []
    this.onSaveObservable = new Observable()
    this.onMoveObservable = new Observable()
  }

  /**
   * Creates a camera in current scene, that supports animated zooming and panning.
   * It can not leave the table.
   * Altitude is always in 3D world coordinate, angle in radians, and position in screen coordinates
   * It maintains a list of saves, the first being its initial state.
   * @param {object} params - parameters, including:
   * @param {number} params.y? - initial altitude
   * @param {number} params.beta? - initial beta angle
   * @param {number} params.minY? - minimum camera altitude, in 3D coordinate
   * @param {number} params.maxY? - maximum camera altitude, in 3D coordinate
   * @param {number} params.minAngle? - minimum camera angle (with x/z plane), in radian
   * @param {import('@babylonjs/core').Scene} params.scene? - scene to host this card (default to last scene).
   */
  init({
    y = 25,
    beta = Math.PI / 8,
    minY = 5,
    maxY = 70,
    minAngle = Math.PI / 4,
    scene,
    handScene
  } = {}) {
    this.minAngle = minAngle

    logger.info({ y, minY, maxY }, 'initialize camera manager')
    this.camera = new ArcRotateCamera(
      'camera',
      (3 * Math.PI) / 2,
      beta,
      y,
      Vector3.Zero(),
      scene
    )
    this.camera.lockedTarget = Vector3.Zero()
    this.camera.allowUpsideDown = false
    this.camera.lowerRadiusLimit = minY
    this.camera.upperRadiusLimit = maxY
    this.camera.upperBetaLimit = Math.PI / 3
    this.camera.useBouncingBehavior = false
    this.camera.useAutoRotationBehavior = false
    this.camera.useFramingBehavior = false
    this.camera.useNaturalPinchZoom = false
    this.camera.onDisposeObservable.addOnce(() =>
      logger.info('release camera manager')
    )
    this.camera.getScene().onDisposeObservable.addOnce(() => {
      this.onSaveObservable.clear()
      this.onMoveObservable.clear()
    })

    this.saves = [serialize(this.camera)]

    this.handSceneCamera = new FlyCamera(
      'camera',
      new Vector3(0, 20, 0),
      handScene
    )
    this.handSceneCamera.rotation.x = Math.PI * 0.5
  }

  /**
   * Adjust the main camera zoom range (when relevant), and the fixed hand zoom (when relevant).
   * Also adjust default camera position when changing the initial zoom level.
   * @param {object} params - game data, including:
   * @param {number} params.min? - minimum zoom level allowed on the main scene.
   * @param {number} params.max? - maximum zoom level allowed on the main scene.
   * @param {number} params.initial? - initial zoom level for the main scene.
   * @param {number} params.handZoom? - fixed zoom level for the hand scene.
   * @throws {Error} when called prior to initialization.
   */
  adjustZoomLevels({ min, max, hand, initial }) {
    const { camera, handSceneCamera } = this
    if (!camera) {
      throw new Error(
        `please init the camera manager prior to adjusting zoom levels`
      )
    }
    if (min) {
      camera.lowerRadiusLimit = min
    }
    if (max) {
      camera.upperRadiusLimit = max
    }
    if (initial) {
      camera.radius = initial
      this.saves[0] = serialize(camera)
    }
    if (hand) {
      handSceneCamera.position.y = hand
    }
  }

  /**
   * Applies a given movement to the camera on x/z plane, with animation.
   * Coordinates outside the table will be ignored.
   * Ends with the animation.
   * @async
   * @param {import('../utils').ScreenPosition} movementStart - movement starting point, in screen coordinate.
   * @param {import('../utils').ScreenPosition} movementEnd -movement ending point, in screen coordinate.
   * @param {number} [duration=300] - animation duration, in ms.
   */
  async pan(movementStart, movementEnd, duration = 300) {
    if (!this.camera) return
    const scene = this.camera.getScene()

    const start = screenToGround(scene, movementStart)
    const end = screenToGround(scene, movementEnd)

    const target = this.camera[pan.targetProperty].add(
      new Vector3(start.x - end.x, 0, start.z - end.z)
    )

    if (isPositionAboveTable(scene, target)) {
      await animate(this, { target }, duration)
    }
  }

  /**
   * Rotates the camera by a given angles, with animation.
   * Coordinates outside the table will be ignored.
   * Ends with the animation.
   * @async.=
   * @param {number} [alpha=0] - longitudinal rotation (around the Z axis), in radian.
   * @param {number} [beta=0] - latitudinal rotation, in radian, between minAngle and PI/2.
   * @param {number} [duration=300] - animation duration, in ms.
   */
  async rotate(alpha = 0, beta = 0, duration = 300) {
    if (!this.camera) return

    if ((alpha || beta) && !currentAnimation) {
      await animate(
        this,
        { alpha: this.camera.alpha + alpha, beta: this.camera.beta + beta },
        duration
      )
    }
  }

  /**
   * Zooms the camera in or out by a given step, with animation.
   * Ends with the animation.
   * @async
   * @param {number} step - positive or negative elevation (in 3D world coordinates).
   * @param {number} [duration=300] - animation duration, in ms.
   */
  async zoom(elevation, duration = 300) {
    if (!this.camera) return
    await animate(this, { elevation: this.camera.radius + elevation }, duration)
  }

  /**
   * Saves camera current position into a given slot.
   * Does nothing if the specified index is not within [0..saves.length].
   * Notifies observers.
   * @param {number} [index=0] - slot where the state is saved.
   */
  save(index = 0) {
    if (!this.camera || index < 0 || index > this.saves.length) return
    this.saves[index] = serialize(this.camera)
    this.onSaveObservable.notifyObservers([...this.saves])
  }

  /**
   * Moves camera back to one of its saved position.
   * Does nothing if the specified index is not within [0..saves.length-1].
   * @param {number} [index=0] - slot where the state was saved.
   * @param {number} [duration=300] - animation duration, in milliseconds.
   */
  async restore(index = 0, duration = 300) {
    if (!this.camera || !this.saves[index]) return
    await animate(
      this,
      {
        ...this.saves[index],
        target: Vector3.FromArray(this.saves[index].target)
      },
      duration
    )
  }

  /**
   * Loads saved position and notifies observers.
   * @param {CameraSave[]} saves - an array of save position.
   */
  loadSaves(saves) {
    this.saves = saves
    this.onSaveObservable.notifyObservers([...this.saves])
  }
}

/**
 * Camera manager singleton.
 * @type {CameraManager}
 */
export const cameraManager = new CameraManager()

const logger = makeLogger('camera')

const frameRate = 10

const rotateAlpha = new Animation(
  'rotateAlpha',
  'alpha',
  frameRate,
  Animation.ANIMATIONTYPE_FLOAT,
  Animation.ANIMATIONLOOPMODE_CONSTANT
)

const rotateBeta = new Animation(
  'rotateBeta',
  'beta',
  frameRate,
  Animation.ANIMATIONTYPE_FLOAT,
  Animation.ANIMATIONLOOPMODE_CONSTANT
)

const elevate = new Animation(
  'elevate',
  'radius',
  frameRate,
  Animation.ANIMATIONTYPE_FLOAT,
  Animation.ANIMATIONLOOPMODE_CONSTANT
)

const pan = new Animation(
  'pan',
  'lockedTarget',
  frameRate,
  Animation.ANIMATIONTYPE_VECTOR3,
  Animation.ANIMATIONLOOPMODE_CONSTANT
)

let currentAnimation
let cancelInterval

async function animate(
  { camera, onMoveObservable },
  { alpha, beta, elevation, target },
  duration
) {
  const lastFrame = Math.round(frameRate * (duration / 1000))
  const anims = []
  if (alpha !== undefined) {
    rotateAlpha.setKeys([
      { frame: 0, value: camera[rotateAlpha.targetProperty] },
      { frame: lastFrame, value: alpha }
    ])
    anims.push(rotateAlpha)
  }
  if (beta !== undefined) {
    rotateBeta.setKeys([
      { frame: 0, value: camera[rotateBeta.targetProperty] },
      { frame: lastFrame, value: beta }
    ])
    anims.push(rotateBeta)
  }
  if (elevation !== undefined) {
    elevate.setKeys([
      { frame: 0, value: camera[elevate.targetProperty] },
      { frame: lastFrame, value: elevation }
    ])
    anims.push(elevate)
  }
  if (target) {
    pan.setKeys([
      { frame: 0, value: camera[pan.targetProperty] },
      { frame: lastFrame, value: target }
    ])
    anims.push(pan)
  }
  logger.debug(
    {
      from: {
        alpha: camera[rotateAlpha.targetProperty],
        beta: camera[rotateBeta.targetProperty],
        elevation: camera[elevate.targetProperty],
        target: camera[pan.targetProperty].asArray()
      },
      to: { alpha, beta, elevation, target: target?.asArray() }
    },
    `animate camera`
  )
  return new Promise(resolve => {
    currentAnimation?.stop()
    currentAnimation = camera
      .getScene()
      .beginDirectAnimation(camera, anims, 0, lastFrame, false, 1, () => {
        cancelInterval?.()
        currentAnimation = null
        // fix alpha to keep it within PI/2 and 5*PI/2: this ensure minimal rotation when animating positions
        fixAlpha(camera)
        onMoveObservable.notifyObservers(serialize(camera))
        resolve()
      })
  })
}

function serialize(camera) {
  return addHash({
    alpha: camera[rotateAlpha.targetProperty],
    beta: camera[rotateBeta.targetProperty],
    elevation: camera[elevate.targetProperty],
    target: camera[pan.targetProperty].asArray()
  })
}

function addHash(save) {
  save.hash = `${save.target[0]}-${save.target[1]}-${save.target[2]}-${save.alpha}-${save.beta}-${save.elevation}`
  return save
}

function fixAlpha(camera) {
  if (camera.alpha < Math.PI / 2) {
    camera.alpha += 2 * Math.PI
  } else if (camera.alpha > (5 * Math.PI) / 2) {
    camera.alpha -= 2 * Math.PI
  }
}
