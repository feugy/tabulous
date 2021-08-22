import {
  Animation,
  ArcRotateCamera,
  Observable,
  Vector3
} from '@babylonjs/core'
import { isAboveTable, screenToGround } from '../utils'
// '../../utils' creates a cyclic dependency in Jest
import { makeLogger } from '../../utils/logger'

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

async function animate(camera, { alpha, beta, elevation, target }, duration) {
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
        currentAnimation = null
        // fix alpha to keep it within PI/2 and 5*PI/2: this ensure minimal rotation when animating positions
        if (camera.alpha < Math.PI / 2) {
          camera.alpha += 2 * Math.PI
        } else if (camera.alpha > (5 * Math.PI) / 2) {
          camera.alpha -= 2 * Math.PI
        }
        resolve()
      })
  })
}

function saveState(camera) {
  return {
    alpha: camera[rotateAlpha.targetProperty],
    beta: camera[rotateBeta.targetProperty],
    elevation: camera[elevate.targetProperty],
    target: camera[pan.targetProperty].asArray()
  }
}

/**
 * @typedef {object} CameraSave camera state save, including:
 * @property {number[]} target - camera locked target, as an array of 3D coordinates.
 * @property {number} alpha - alpha angle, in radian.
 * @property {number} beta - beta angle, in radia.
 * @property {number} elevation - altitude, in 3D coordinate.
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
   * @property {CameraSave[]} saves? - list of camera state saves.
   * @property {Observable<CameraSave[]>} onSaveObservable - emits when saving new camera positions.
   */
  constructor() {
    this.camera = null
    this.minAngle = 0
    this.saves = []
    this.onSaveObservable = new Observable()
  }

  /**
   * Creates a camera in current scene, that supports animated zooming and panning.
   * It can not leave the table.
   * Altitude is always in 3D world coordinate, angle in radians, and position in screen coordinates
   * It maintains a list of saves, the first being its initial state (can  not be changed).
   * @param {object} params - parameters, including:
   * @param {number} params.y? - initial altitude
   * @param {number} params.alpha? - initial alpha angle
   * @param {number} params.minY? - minimum camera altitude, in 3D coordinate
   * @param {number} params.maxY? - maximum camera altitude, in 3D coordinate
   * @param {number} params.minAngle? - minimum camera angle (with x/z plane), in radian
   */
  init({
    y = 25,
    alpha = Math.PI / 8,
    minY = 5,
    maxY = 70,
    minAngle = Math.PI / 4
  } = {}) {
    this.minAngle = minAngle

    logger.info({ y, minY, maxY }, 'initialize camera manager')
    this.camera = new ArcRotateCamera(
      'camera',
      (3 * Math.PI) / 2,
      alpha,
      y,
      Vector3.Zero()
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
    this.camera
      .getScene()
      .onDisposeObservable.addOnce(() => this.onSaveObservable.clear())

    this.saves = [saveState(this.camera)]
  }

  /**
   * Moves the camera on x/z plane to face a given screen coordinate, with animation.
   * Coordinates outside the table will be ignored
   * @param {import('../utils').ScreenPosition} to - screen position to move camera to.
   * @param {number} [duration=300] - animation duration, in ms
   */
  pan(to, duration = 300) {
    if (!this.camera) return

    const scene = this.camera.getScene()
    if (isAboveTable(scene, to)) {
      animate(this.camera, { target: screenToGround(scene, to) }, duration)
    }
  }

  /**
   * Rotates the camera by a given angles, with animation.
   * Coordinates outside the table will be ignored
   * @param {number} [alpha=0] - longitudinal rotation (around the Z axis), in radian
   * @param {number} [beta=0] - latitudinal rotation, in radian, between minAngle and PI/2
   * @param {number} [duration=300] - animation duration, in ms
   */
  rotate(alpha = 0, beta = 0, duration = 300) {
    if (!this.camera) return

    if ((alpha || beta) && !currentAnimation) {
      animate(
        this.camera,
        { alpha: this.camera.alpha + alpha, beta: this.camera.beta + beta },
        duration
      )
    }
  }

  /**
   * Zooms the camera in or out by a given step, with animation.
   * @param {number} step - positive or negative elevation (in 3D world coordinates).
   * @param {number} [duration=300] - animation duration, in ms
   */
  zoom(elevation, duration = 300) {
    if (!this.camera) return
    animate(
      this.camera,
      { elevation: this.camera.radius + elevation },
      duration
    )
  }

  /**
   * Saves camera current position into a given slot.
   * The first slot is reserved.
   * Does nothing if the specified index is not within [1..saves.length].
   * Notifies observers.
   * @param {number} [index=1] - slot where the state is saved.
   */
  save(index = 1) {
    if (!this.camera || index < 1 || index > this.saves.length) return
    this.saves[index] = saveState(this.camera)
    this.onSaveObservable.notifyObservers(this.saves.slice(1))
  }

  /**
   * Moves camera back to one of its saved position.
   * Does nothing if the specified index is not within [0..saves.length-1].
   * @param {number} [index=0] - slot where the state was saved.
   * @param {number} [duration=300] - animation duration, in milliseconds.
   */
  restore(index = 0, duration = 300) {
    if (!this.camera || !this.saves[index]) return
    animate(
      this.camera,
      {
        ...this.saves[index],
        target: Vector3.FromArray(this.saves[index].target)
      },
      duration
    )
  }

  /**
   * Loads saves position, keeping only the first save which can not be changed.
   * Notifies observers.
   * @param {CameraSave[]} saves - an array of save position
   */
  loadSaves(saves) {
    this.saves.splice(1, this.saves.length, ...saves)
    this.onSaveObservable.notifyObservers(this.saves.slice(1))
  }
}

/**
 * Camera manager singleton.
 * @type {CameraManager}
 */
export const cameraManager = new CameraManager()
