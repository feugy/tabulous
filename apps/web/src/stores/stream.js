// @ts-check
import { makeLogger } from '@src/utils'
import { BehaviorSubject } from 'rxjs'

import { browser } from '$app/environment'

const logger = makeLogger('stream')
const lastCameraStorageKey = 'lastCameraId'
const lastMicStorageKey = 'lastMicId'

const stream = new BehaviorSubject(/** @type {?MediaStream} */ (null))
const cameras = new BehaviorSubject(/** @type {MediaDeviceInfo[]} */ ([]))
const mics = new BehaviorSubject(/** @type {MediaDeviceInfo[]} */ ([]))
const currentCamera = new BehaviorSubject(
  /** @type {?MediaDeviceInfo} */ (null)
)
const currentMic = new BehaviorSubject(/** @type {?MediaDeviceInfo} */ (null))
const streamChange$ = new BehaviorSubject(
  /** @type {import('@src/utils').StreamState} */ ({
    muted: false,
    stopped: false
  })
)

if (browser) {
  navigator.mediaDevices?.addEventListener('devicechange', enumerateDevices)
}

let acquireInProgress = /** @type {?Promise<?MediaStream>} */ (null)

/**
 * Emits the local media stream, that is audio and video allowed and selected by user
 */
export const stream$ = stream.asObservable()

/**
 * Emits when user select a different camera.
 * Empty until acquiring the first media stream.
 */
export const currentCamera$ = currentCamera.asObservable()

/**
 * Emits a list of available cameras.
 * Empty until acquiring the first media stream.
 */
export const cameras$ = cameras.asObservable()

/**
 * Emits when user select a different microphone.
 * Empty until acquiring the first media stream.
 */
export const currentMic$ = currentMic.asObservable()

/**
 * Emits a list of available microphones.
 * Empty until acquiring the first media stream.
 */
export const mics$ = mics.asObservable()

/**
 * Emits when the local media has been muted, unmutted, stopped or resumed
 */
export const localStreamChange$ = streamChange$.asObservable()

/**
 * Acquires local video and audio stream.
 * Asks end user for permission, and populates `stream$` observable.
 * Supports concurrent calls: first call will asynchronously acquire stream,
 * while concurrent calls will wait and reuse the same result.
 * @param {?MediaDeviceInfo} [desired] - desired device.
 * @return {Promise<?MediaStream>} the acquired stream , if any
 */
export async function acquireMediaStream(desired = null) {
  logger.debug({ desired }, `acquiring local media steam`)
  stopStream(stream.value)
  if (!navigator.mediaDevices) {
    logger.info(`This browser does not support media devices`)
    resetAll()
    return null
  }
  if (acquireInProgress) {
    return acquireInProgress
  }

  const last = loadLastMediaIds()
  if (mics.value.length === 0 && cameras.value.length === 0) {
    await enumerateDevices()
  }
  const video = getDesiredOrDefault(desired, last.cameraId, cameras.value)
  const audio = getDesiredOrDefault(desired, last.micId, mics.value)
  acquireInProgress = acquire(video, audio)
  const result = await acquireInProgress
  acquireInProgress = null
  return result
}

/**
 * Acquire streams from media devices.
 * @param {?MediaDeviceInfo} video - selected camera.
 * @param {?MediaDeviceInfo} audio - selected mic.
 * @returns {Promise<?MediaStream>} resulting media stream, if any.
 */
async function acquire(video, audio) {
  try {
    logger.debug({ video, audio }, `acquiring media devices`)
    currentCamera.next(video)
    currentMic.next(audio)
    saveLastMediaIds({ audio, video })
    const result = await navigator.mediaDevices.getUserMedia({
      audio: audio || undefined,
      video: video
        ? { deviceId: video.deviceId, aspectRatio: { ideal: 16 / 9 } }
        : undefined
    })
    stream.next(result)
    recordStreamChange(streamChange$.value)
    logger.info(`media successfully attached`)
    return result
  } catch (error) {
    logger.warn(
      { error },
      `Failed to access media devices: ${/** @type {Error} */ (error).message}`
    )
    resetAll()
    return null
  }
}

/**
 * Releases local video and audio stream, and populates `stream$` observable with null.
 * Does nothing when stream is already null
 */
export function releaseMediaStream() {
  logger.info(`releasing local media steam`)
  stopStream(stream.value)
  if (stream.value) {
    resetAll()
  }
}

/**
 * Records a change in the local media stream state.
 * Emits on localStreamChange$.
 * @param {import('@src/utils').StreamState} state - new state for the current video stream.
 */
export function recordStreamChange({ muted, stopped }) {
  if (stream.value) {
    for (const track of stream.value.getAudioTracks()) {
      track.enabled = !muted
    }
    for (const track of stream.value.getVideoTracks()) {
      track.enabled = !stopped
    }
    streamChange$.next({ muted, stopped })
  }
}

/**
 * List all available devices, ignoring unusable ones
 */
async function enumerateDevices() {
  try {
    logger.info(`enumerating media devices`)
    const devices = await navigator.mediaDevices.enumerateDevices()
    /** @type {MediaDeviceInfo[]} */
    const micDevices = []
    /** @type {MediaDeviceInfo[]} */
    const cameraDevices = []
    for (const device of devices) {
      if (device?.kind && !device?.label.startsWith('Monitor of')) {
        if (device.kind === 'audioinput') {
          micDevices.push(device)
          logger.debug(device, `found mic ${device.label}`)
        } else if (device.kind === 'videoinput') {
          cameraDevices.push(device)
          logger.debug(device, `found camera ${device.label}`)
        }
      }
    }
    mics.next(micDevices)
    cameras.next(cameraDevices)
  } catch (error) {
    logger.warn(
      { error },
      `Failed to enumerate media devices: ${
        /** @type {Error} */ (error).message
      }`
    )
    resetAll()
  }
}

/**
 * Tries to find desired device, or the last one used.
 * @param {?MediaDeviceInfo} desired - desired device.
 * @param {?MediaDeviceInfo['deviceId']} lastId - id of the last device used.
 * @param {MediaDeviceInfo[]} devices - list of available devices.
 * @returns {?MediaDeviceInfo} desired device if available, or last used, or the first available, or null
 */
function getDesiredOrDefault(desired, lastId, devices) {
  const defaultDevice =
    devices.find(({ deviceId }) => deviceId === lastId) ?? devices[0] ?? null
  return desired?.kind === defaultDevice?.kind ? desired : defaultDevice
}

/**
 * Stops all tracks of a stream
 * @param {?MediaStream} stream - stopped stream.
 */
function stopStream(stream) {
  for (const track of stream?.getTracks() ?? []) {
    track.stop()
  }
}

/**
 * Loads from local storage ids of the last used camera and mic.
 * @returns {{cameraId: ?string, micId: ?string }} loaded ids.
 */
function loadLastMediaIds() {
  return {
    cameraId: localStorage.getItem(lastCameraStorageKey),
    micId: localStorage.getItem(lastMicStorageKey)
  }
}

/**
 * Stores in local storage ids of the currently used camera and mic.
 * @param {{ audio: ?MediaDeviceInfo, video: ?MediaDeviceInfo }} devices - devices in use
 */
function saveLastMediaIds({ audio, video }) {
  if (video) {
    localStorage.setItem(lastCameraStorageKey, video.deviceId)
  }
  if (audio) {
    localStorage.setItem(lastMicStorageKey, audio.deviceId)
  }
}

function resetAll() {
  stream.next(null)
  currentCamera.next(null)
  currentMic.next(null)
  cameras.next([])
  mics.next([])
}
