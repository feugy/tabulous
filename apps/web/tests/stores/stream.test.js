import { faker } from '@faker-js/faker'
import { get } from 'svelte/store'
import {
  acquireMediaStream,
  cameraDevices$,
  currentCameraDevice$,
  currentMicDevice$,
  micDevices$,
  releaseMediaStream,
  stream$
} from '../../src/stores/stream'
import { mockLogger } from '../utils.js'

describe('Media Stream store', () => {
  const logger = mockLogger('stream')
  const camerasReceived = jest.fn()
  const currentCameraReceived = jest.fn()
  const currentMicReceived = jest.fn()
  const micsReceived = jest.fn()
  const streamReceived = jest.fn()
  const noMediaMessage = 'does not support media devices'
  const unauthorizedMediaMessage = 'Failed to access media devices'
  let subscriptions

  beforeAll(() => {
    subscriptions = [
      cameraDevices$.subscribe(camerasReceived),
      currentCameraDevice$.subscribe(currentCameraReceived),
      currentMicDevice$.subscribe(currentMicReceived),
      micDevices$.subscribe(micsReceived),
      stream$.subscribe(streamReceived)
    ]
  })

  beforeEach(jest.resetAllMocks)

  afterAll(() => {
    for (const subscription of subscriptions) {
      subscription.unsubscribe()
    }
  })

  it('has no mics nor cameras before acquiring', () => {
    expect(get(stream$)).toBeNull()
    expect(get(currentMicDevice$)).toBeNull()
    expect(get(currentCameraDevice$)).toBeNull()
    expect(get(micDevices$)).toEqual([])
    expect(get(cameraDevices$)).toEqual([])
  })

  describe('given no media devices', () => {
    describe('acquireMediaStream()', () => {
      it('resets all', async () => {
        await acquireMediaStream()
        expect(get(stream$)).toBeNull()
        expect(get(currentMicDevice$)).toBeNull()
        expect(get(currentCameraDevice$)).toBeNull()
        expect(get(micDevices$)).toEqual([])
        expect(get(cameraDevices$)).toEqual([])
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringMatching(noMediaMessage)
        )
        expect(logger.warn).not.toHaveBeenCalled()
        expect(streamReceived).toHaveBeenCalledTimes(1)
        expect(camerasReceived).toHaveBeenCalledTimes(1)
        expect(currentCameraReceived).toHaveBeenCalledTimes(1)
        expect(micsReceived).toHaveBeenCalledTimes(1)
        expect(currentMicReceived).toHaveBeenCalledTimes(1)
      })
    })

    describe('releaseMediaStream()', () => {
      it('resets all', () => {
        releaseMediaStream()
        expect(get(stream$)).toBeNull()
        expect(get(currentMicDevice$)).toBeNull()
        expect(get(currentCameraDevice$)).toBeNull()
        expect(get(micDevices$)).toEqual([])
        expect(get(cameraDevices$)).toEqual([])
      })
    })
  })

  describe('given unauthorized media', () => {
    beforeEach(() => {
      navigator.mediaDevices = {
        addEventListener: jest.fn(),
        enumerateDevices: jest
          .fn()
          .mockRejectedValue(new Error('unauthorized')),
        getUserMedia: jest.fn().mockRejectedValue(new Error('unauthorized'))
      }
    })

    describe('acquireMediaStream()', () => {
      it('resets all', async () => {
        await acquireMediaStream()
        expect(get(stream$)).toBeNull()
        expect(get(currentMicDevice$)).toBeNull()
        expect(get(currentCameraDevice$)).toBeNull()
        expect(get(micDevices$)).toEqual([])
        expect(get(cameraDevices$)).toEqual([])
        expect(logger.warn).toHaveBeenCalledWith(
          expect.anything(),
          expect.stringMatching(unauthorizedMediaMessage)
        )
        expect(logger.info).not.toHaveBeenCalledWith(
          expect.stringMatching(noMediaMessage)
        )
        expect(streamReceived).toHaveBeenCalledTimes(1)
        expect(camerasReceived).toHaveBeenCalledTimes(1)
        expect(currentCameraReceived).toHaveBeenCalledTimes(1)
        expect(micsReceived).toHaveBeenCalledTimes(1)
        expect(currentMicReceived).toHaveBeenCalledTimes(1)
      })
    })

    describe('releaseMediaStream()', () => {
      it('resets all', () => {
        releaseMediaStream()
        expect(get(stream$)).toBeNull()
        expect(get(currentMicDevice$)).toBeNull()
        expect(get(currentCameraDevice$)).toBeNull()
        expect(get(micDevices$)).toEqual([])
        expect(get(cameraDevices$)).toEqual([])
      })
    })
  })

  describe('given authorized media', () => {
    const stream = {
      id: faker.datatype.uuid(),
      getTracks: jest.fn()
    }

    const devices = [
      { kind: 'videoinput', deviceId: 'idA', label: 'front camera' },
      { kind: 'videoinput', deviceId: 'idB', label: 'read camera' },
      { kind: 'audioinput', deviceId: 'idC', label: 'Monitor of main mic' },
      { kind: 'audioinput', deviceId: 'idD', label: 'main mic' },
      { kind: 'audioinput', deviceId: 'idE', label: 'ambiant mic' },
      { kind: 'unknown', deviceId: 'idF', label: 'unknown' }
    ]

    const mics = devices.slice(3, 5)
    const cameras = devices.slice(0, 2)

    beforeEach(() => {
      releaseMediaStream()
      navigator.mediaDevices = {
        addEventListener: jest.fn(),
        enumerateDevices: jest.fn().mockResolvedValue(devices),
        getUserMedia: jest.fn().mockResolvedValue(stream)
      }
      localStorage.clear()
      jest.clearAllMocks()
    })

    describe('acquireMediaStream()', () => {
      it('returns streamn, sets current devices and save ids in local storage', async () => {
        await acquireMediaStream()
        expect(get(stream$)).toEqual(stream)
        expectCurrentMic(devices[3])
        expect(get(micDevices$)).toEqual(mics)
        expectCurrentCamera(devices[0])
        expect(get(cameraDevices$)).toEqual(cameras)
        expect(logger.warn).not.toHaveBeenCalled()
        expect(streamReceived).toHaveBeenCalledTimes(1)
        expect(camerasReceived).toHaveBeenCalledTimes(1)
        expect(micsReceived).toHaveBeenCalledTimes(1)
      })

      it('uses desired camera', async () => {
        await acquireMediaStream(devices[1])
        expect(get(stream$)).toEqual(stream)
        expectCurrentMic(devices[3])
        expect(get(micDevices$)).toEqual(devices.slice(3, 5))
        expectCurrentCamera(devices[1])
        expect(get(cameraDevices$)).toEqual(cameras)
        expect(logger.warn).not.toHaveBeenCalled()
        expect(streamReceived).toHaveBeenCalledTimes(1)
        expect(camerasReceived).toHaveBeenCalledTimes(1)
        expect(micsReceived).toHaveBeenCalledTimes(1)
      })

      it('uses desired microphone', async () => {
        await acquireMediaStream(devices[4])
        expect(get(stream$)).toEqual(stream)
        expectCurrentMic(devices[4])
        expect(get(micDevices$)).toEqual(devices.slice(3, 5))
        expectCurrentCamera(devices[0])
        expect(get(cameraDevices$)).toEqual(cameras)
        expect(logger.warn).not.toHaveBeenCalled()
        expect(streamReceived).toHaveBeenCalledTimes(1)
        expect(camerasReceived).toHaveBeenCalledTimes(1)
        expect(micsReceived).toHaveBeenCalledTimes(1)
      })

      it('reuses last microphone and camera', async () => {
        localStorage.lastCameraId = devices[1].deviceId
        localStorage.lastMicId = devices[4].deviceId
        await acquireMediaStream()
        expect(get(stream$)).toEqual(stream)
        expectCurrentMic(devices[4])
        expect(get(micDevices$)).toEqual(devices.slice(3, 5))
        expectCurrentCamera(devices[1])
        expect(get(cameraDevices$)).toEqual(cameras)
        expect(logger.warn).not.toHaveBeenCalled()
        expect(streamReceived).toHaveBeenCalledTimes(1)
        expect(camerasReceived).toHaveBeenCalledTimes(1)
        expect(micsReceived).toHaveBeenCalledTimes(1)
      })

      it(`defaults to first device when last can't be found`, async () => {
        localStorage.lastCameraId = faker.datatype.uuid()
        localStorage.lastMicId = faker.datatype.uuid()
        await acquireMediaStream()
        expect(get(stream$)).toEqual(stream)
        expectCurrentMic(devices[3])
        expect(get(micDevices$)).toEqual(devices.slice(3, 5))
        expectCurrentCamera(devices[0])
        expect(get(cameraDevices$)).toEqual(cameras)
        expect(logger.warn).not.toHaveBeenCalled()
        expect(streamReceived).toHaveBeenCalledTimes(1)
        expect(camerasReceived).toHaveBeenCalledTimes(1)
        expect(micsReceived).toHaveBeenCalledTimes(1)
      })

      it('does not enumerate devices twice', async () => {
        await acquireMediaStream()
        await acquireMediaStream()
        expect(navigator.mediaDevices.enumerateDevices).toHaveBeenCalledTimes(1)
      })
    })

    describe('releaseMediaStream()', () => {
      beforeEach(() => acquireMediaStream())

      it('resets all', () => {
        const tracks = [{ stop: jest.fn() }, { stop: jest.fn() }]
        stream.getTracks.mockReturnValue(tracks)
        releaseMediaStream()
        expect(tracks[0].stop).toHaveBeenCalledTimes(1)
        expect(tracks[1].stop).toHaveBeenCalledTimes(1)
        expect(get(stream$)).toBeNull()
        expect(get(currentMicDevice$)).toBeNull()
        expect(get(currentCameraDevice$)).toBeNull()
        expect(get(micDevices$)).toEqual([])
        expect(get(cameraDevices$)).toEqual([])
      })
    })
  })

  function expectCurrentMic(device) {
    expect(get(currentMicDevice$)).toEqual(device)
    expect(localStorage.lastMicId).toEqual(device.deviceId)
    expect(currentMicReceived).toHaveBeenCalledTimes(1)
    expect(currentMicReceived).toHaveBeenCalledWith(device)
    currentMicReceived.mockClear()
  }

  function expectCurrentCamera(device) {
    expect(get(currentCameraDevice$)).toEqual(device)
    expect(localStorage.lastCameraId).toEqual(device.deviceId)
    expect(currentCameraReceived).toHaveBeenCalledTimes(1)
    expect(currentCameraReceived).toHaveBeenCalledWith(device)
    currentCameraReceived.mockClear()
  }
})
