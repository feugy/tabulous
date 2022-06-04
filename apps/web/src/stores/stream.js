import { BehaviorSubject } from 'rxjs'
import { makeLogger } from '../utils'

const logger = makeLogger('stream')
const lastCameraStorageKey = 'lastCameraId'
const lastMicStorageKey = 'lastMicId'

let stream = new BehaviorSubject(null)
let cameras = new BehaviorSubject([])
let mics = new BehaviorSubject([])
let currentCamera = new BehaviorSubject(null)
let currentMic = new BehaviorSubject(null)
navigator.mediaDevices?.addEventListener('devicechange', enumerateDevices)

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
export const currentCameraDevice$ = currentCamera.asObservable()

/**
 * Emits a list of available cameras.
 * Empty until acquiring the first media stream.
 * @type {Observable<MediaDeviceInfo[]>}
 */
export const cameraDevices$ = cameras.asObservable()

/**
 * Emits when user select a different microphone.
 * Empty until acquiring the first media stream.
 * @type {Observable<MediaDeviceInfo>}
 */
export const currentMicDevice$ = currentMic.asObservable()

/**
 * Emits a list of available microphones.
 * Empty until acquiring the first media stream.
 * @type {Observable<MediaDeviceInfo[]>}
 */
export const micDevices$ = mics.asObservable()

/**
 * Acquires local video and audio stream.
 * Asks end user for permission, and populates `stream$` observable.
 * Does nothing when stream is already attached
 * @param {MediaDeviceInfo} desired? - desired device.
 */
export async function acquireMediaStream(desired) {
  logger.debug({ desired }, `acquiring local media steam`)
  stopStream(stream.value)
  if (navigator.mediaDevices) {
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
      stream.next(await navigator.mediaDevices.getUserMedia({ audio, video }))
      logger.info(`media successfully attached`)
    } catch (error) {
      logger.warn({ error }, `Failed to access media devices: ${error.message}`)
      resetAll()
    }
  } else {
    logger.info(`This browser does not support media devices`)
    resetAll()
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

async function enumerateDevices() {
  logger.info(`enumerating media devices`)
  const devices = await navigator.mediaDevices.enumerateDevices()
  const micDevices = []
  const cameraDevices = []
  for (const device of devices) {
    if (!device.label.startsWith('Monitor of')) {
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
  return desired?.kind === defaultDevice.kind ? desired : defaultDevice
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
  localStorage.setItem(lastCameraStorageKey, video.deviceId)
  localStorage.setItem(lastMicStorageKey, audio.deviceId)
}

function resetAll() {
  stream.next(null)
  currentCamera.next(null)
  currentMic.next(null)
  cameras.next([])
  mics.next([])
}
