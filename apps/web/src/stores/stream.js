import { BehaviorSubject, Subject } from 'rxjs'

import { browser } from '$app/environment'

import { makeLogger } from '../utils'

const logger = makeLogger('stream')
const lastCameraStorageKey = 'lastCameraId'
const lastMicStorageKey = 'lastMicId'

const stream = new BehaviorSubject(null)
const cameras = new BehaviorSubject([])
const mics = new BehaviorSubject([])
const currentCamera = new BehaviorSubject(null)
const currentMic = new BehaviorSubject(null)
const streamChange$ = new Subject()
if (browser) {
  navigator.mediaDevices?.addEventListener('devicechange', enumerateDevices)
}
let acquireInProgress = null

/**
 * Emits the local media stream, that is audio and video allowed and selected by user
 * @type {Observable<MediaStream>}
 */
export const stream$ = stream.asObservable()

/**
 * Emits when user select a different camera.
 * Empty until acquiring the first media stream.
 * @type {Observable<MediaDeviceInfo>}
 */
export const currentCamera$ = currentCamera.asObservable()

/**
 * Emits a list of available cameras.
 * Empty until acquiring the first media stream.
 * @type {Observable<MediaDeviceInfo[]>}
 */
export const cameras$ = cameras.asObservable()

/**
 * Emits when user select a different microphone.
 * Empty until acquiring the first media stream.
 * @type {Observable<MediaDeviceInfo>}
 */
export const currentMic$ = currentMic.asObservable()

/**
 * Emits a list of available microphones.
 * Empty until acquiring the first media stream.
 * @type {Observable<MediaDeviceInfo[]>}
 */
export const mics$ = mics.asObservable()

/**
 * @typedef {object} MediaState - new state of the local media stream.
 * @property {boolean} muted - true when microphone has been muted.
 * @property {boolean} stopped - true when video has been stopped.
 */

/**
 * Emits when the local media has been muted, unmutted, stopped or resumed
 * @type {Observable<MediaState>}
 */
export const localStreamChange$ = streamChange$.asObservable()

/**
 * Acquires local video and audio stream.
 * Asks end user for permission, and populates `stream$` observable.
 * Supports concurrent calls: first call will asynchronously acquire stream,
 * while concurrent calls will wait and reuse the same result.
 * @param {MediaDeviceInfo} desired? - desired device.
 * @return {MediaStream} the acquired stream , if any
 */
export async function acquireMediaStream(desired) {
  logger.debug({ desired }, `acquiring local media steam`)
  stopStream(stream.value)
  if (!navigator.mediaDevices) {
    logger.info(`This browser does not support media devices`)
    resetAll()
    return
  }
  if (acquireInProgress) {
    return acquireInProgress
  }

  async function acquire() {
    try {
      const last = loadLastMediaIds()
      if (mics.value.length === 0 && cameras.value.length === 0) {
        await enumerateDevices()
      }
      const video = getDesiredOrDefault(desired, last.cameraId, cameras.value)
      const audio = getDesiredOrDefault(desired, last.micId, mics.value)
      currentCamera.next(video)
      currentMic.next(audio)
      saveLastMediaIds({ audio, video })
      const result = await navigator.mediaDevices.getUserMedia({ audio, video })
      stream.next(result)
      logger.info(`media successfully attached`)
      return result
    } catch (error) {
      logger.warn({ error }, `Failed to access media devices: ${error.message}`)
      resetAll()
    }
  }

  acquireInProgress = acquire()
  const result = await acquireInProgress
  acquireInProgress = null
  return result
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
 * @param {MediaState} state - new state for the current video stream.
 */
export function recordStreamChange(state) {
  if (stream.value) {
    streamChange$.next(state)
  }
}

async function enumerateDevices() {
  logger.info(`enumerating media devices`)
  const devices = await navigator.mediaDevices.enumerateDevices()
  const micDevices = []
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
}

function getDesiredOrDefault(desired, lastId, devices) {
  const defaultDevice =
    devices.find(({ deviceId }) => deviceId === lastId) || devices[0]
  return desired?.kind === defaultDevice?.kind ? desired : defaultDevice
}

function stopStream(stream) {
  for (const track of stream?.getTracks() ?? []) {
    track.stop()
  }
}

function loadLastMediaIds() {
  return {
    cameraId: localStorage.getItem(lastCameraStorageKey),
    micId: localStorage.getItem(lastMicStorageKey)
  }
}

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
