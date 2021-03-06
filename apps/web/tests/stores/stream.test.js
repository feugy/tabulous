import { faker } from '@faker-js/faker'
import { get } from 'svelte/store'
import {
  acquireMediaStream,
  cameras$,
  currentCamera$,
  currentMic$,
  localStreamChange$,
  mics$,
  recordStreamChange,
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
  const localStreamChangeReceived = jest.fn()
  const noMediaMessage = 'does not support media devices'
  const unauthorizedMediaMessage = 'Failed to access media devices'
  let subscriptions

  beforeAll(() => {
    subscriptions = [
      cameras$.subscribe(camerasReceived),
      currentCamera$.subscribe(currentCameraReceived),
      currentMic$.subscribe(currentMicReceived),
      localStreamChange$.subscribe(localStreamChangeReceived),
      mics$.subscribe(micsReceived),
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
    expect(get(currentMic$)).toBeNull()
    expect(get(currentCamera$)).toBeNull()
    expect(get(mics$)).toEqual([])
    expect(get(cameras$)).toEqual([])
  })

  describe('recordStreamChange()', () => {
    it('does not emit a state change', () => {
      recordStreamChange({ muted: false, stopped: true })
      expect(localStreamChangeReceived).not.toHaveBeenCalled()
    })
  })

  describe('given acquireMediaStream() got no media devices', () => {
    beforeEach(() => acquireMediaStream())

    it('resets all', async () => {
      expect(get(stream$)).toBeNull()
      expect(get(currentMic$)).toBeNull()
      expect(get(currentCamera$)).toBeNull()
      expect(get(mics$)).toEqual([])
      expect(get(cameras$)).toEqual([])
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(noMediaMessage)
      )
      expect(logger.warn).not.toHaveBeenCalled()
      expect(streamReceived).toHaveBeenCalledTimes(1)
      expect(camerasReceived).toHaveBeenCalledTimes(1)
      expect(currentCameraReceived).toHaveBeenCalledTimes(1)
      expect(micsReceived).toHaveBeenCalledTimes(1)
      expect(currentMicReceived).toHaveBeenCalledTimes(1)
      expect(localStreamChangeReceived).not.toHaveBeenCalled()
    })

    describe('releaseMediaStream()', () => {
      it('resets all', () => {
        releaseMediaStream()
        expect(get(stream$)).toBeNull()
        expect(get(currentMic$)).toBeNull()
        expect(get(currentCamera$)).toBeNull()
        expect(get(mics$)).toEqual([])
        expect(get(cameras$)).toEqual([])
      })
    })

    describe('recordStreamChange()', () => {
      it('does not emit a state change', () => {
        recordStreamChange({ muted: false, stopped: true })
        expect(localStreamChangeReceived).not.toHaveBeenCalled()
      })
    })
  })

  describe('given acquireMediaStream() got unauthorized media', () => {
    beforeEach(async () => {
      navigator.mediaDevices = {
        addEventListener: jest.fn(),
        enumerateDevices: jest
          .fn()
          .mockRejectedValue(new Error('unauthorized')),
        getUserMedia: jest.fn().mockRejectedValue(new Error('unauthorized'))
      }
      await acquireMediaStream()
    })

    it('resets all', async () => {
      expect(get(stream$)).toBeNull()
      expect(get(currentMic$)).toBeNull()
      expect(get(currentCamera$)).toBeNull()
      expect(get(mics$)).toEqual([])
      expect(get(cameras$)).toEqual([])
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
      expect(localStreamChangeReceived).not.toHaveBeenCalled()
    })

    describe('releaseMediaStream()', () => {
      it('resets all', () => {
        releaseMediaStream()
        expect(get(stream$)).toBeNull()
        expect(get(currentMic$)).toBeNull()
        expect(get(currentCamera$)).toBeNull()
        expect(get(mics$)).toEqual([])
        expect(get(cameras$)).toEqual([])
      })
    })

    describe('recordStreamChange()', () => {
      it('does not emit a state change', () => {
        recordStreamChange({ muted: false, stopped: true })
        expect(localStreamChangeReceived).not.toHaveBeenCalled()
      })
    })
  })

  describe('given acquireMediaStream() got authorized media', () => {
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

    beforeEach(async () => {
      releaseMediaStream()
      navigator.mediaDevices = {
        addEventListener: jest.fn(),
        enumerateDevices: jest.fn().mockResolvedValue(devices),
        getUserMedia: jest.fn().mockResolvedValue(stream)
      }
      localStorage.clear()
      await acquireMediaStream()
    })

    it('returns streamn, sets current devices and save ids in local storage', async () => {
      expect(get(stream$)).toEqual(stream)
      expectCurrentMic(devices[3])
      expect(get(mics$)).toEqual(mics)
      expectCurrentCamera(devices[0])
      expect(get(cameras$)).toEqual(cameras)
      expect(logger.warn).not.toHaveBeenCalled()
      expect(streamReceived).toHaveBeenCalledTimes(1)
      expect(camerasReceived).toHaveBeenCalledTimes(1)
      expect(micsReceived).toHaveBeenCalledTimes(1)
      expect(localStreamChangeReceived).not.toHaveBeenCalled()
    })

    it('uses desired camera', async () => {
      jest.clearAllMocks()
      await acquireMediaStream(devices[1])
      expect(get(stream$)).toEqual(stream)
      expectCurrentMic(devices[3])
      expect(get(mics$)).toEqual(devices.slice(3, 5))
      expectCurrentCamera(devices[1])
      expect(get(cameras$)).toEqual(cameras)
      expect(logger.warn).not.toHaveBeenCalled()
      expect(streamReceived).toHaveBeenCalledTimes(1)
      expect(localStreamChangeReceived).not.toHaveBeenCalled()
    })

    it('uses desired microphone', async () => {
      jest.clearAllMocks()
      await acquireMediaStream(devices[4])
      expect(get(stream$)).toEqual(stream)
      expectCurrentMic(devices[4])
      expect(get(mics$)).toEqual(devices.slice(3, 5))
      expectCurrentCamera(devices[0])
      expect(get(cameras$)).toEqual(cameras)
      expect(logger.warn).not.toHaveBeenCalled()
      expect(streamReceived).toHaveBeenCalledTimes(1)
      expect(localStreamChangeReceived).not.toHaveBeenCalled()
    })

    it('reuses last microphone and camera', async () => {
      jest.clearAllMocks()
      localStorage.lastCameraId = devices[1].deviceId
      localStorage.lastMicId = devices[4].deviceId
      await acquireMediaStream()
      expect(get(stream$)).toEqual(stream)
      expectCurrentMic(devices[4])
      expect(get(mics$)).toEqual(devices.slice(3, 5))
      expectCurrentCamera(devices[1])
      expect(get(cameras$)).toEqual(cameras)
      expect(logger.warn).not.toHaveBeenCalled()
      expect(streamReceived).toHaveBeenCalledTimes(1)
      expect(localStreamChangeReceived).not.toHaveBeenCalled()
    })

    it(`defaults to first device when last can't be found`, async () => {
      jest.clearAllMocks()
      localStorage.lastCameraId = faker.datatype.uuid()
      localStorage.lastMicId = faker.datatype.uuid()
      await acquireMediaStream()
      expect(get(stream$)).toEqual(stream)
      expectCurrentMic(devices[3])
      expect(get(mics$)).toEqual(devices.slice(3, 5))
      expectCurrentCamera(devices[0])
      expect(get(cameras$)).toEqual(cameras)
      expect(logger.warn).not.toHaveBeenCalled()
      expect(streamReceived).toHaveBeenCalledTimes(1)
      expect(localStreamChangeReceived).not.toHaveBeenCalled()
    })

    it('does not enumerate devices twice', async () => {
      await acquireMediaStream()
      expect(navigator.mediaDevices.enumerateDevices).toHaveBeenCalledTimes(1)
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
        expect(get(currentMic$)).toBeNull()
        expect(get(currentCamera$)).toBeNull()
        expect(get(mics$)).toEqual([])
        expect(get(cameras$)).toEqual([])
      })
    })

    describe('recordStreamChange()', () => {
      it('emits a state change', () => {
        const state = {
          muted: faker.datatype.boolean(),
          stopped: faker.datatype.boolean()
        }
        recordStreamChange(state)
        expect(localStreamChangeReceived).toHaveBeenCalledWith(state)
        expect(localStreamChangeReceived).toHaveBeenCalledTimes(1)
      })
    })
  })

  function expectCurrentMic(device) {
    expect(get(currentMic$)).toEqual(device)
    expect(localStorage.lastMicId).toEqual(device.deviceId)
    expect(currentMicReceived).toHaveBeenCalledTimes(1)
    expect(currentMicReceived).toHaveBeenCalledWith(device)
    currentMicReceived.mockClear()
  }

  function expectCurrentCamera(device) {
    expect(get(currentCamera$)).toEqual(device)
    expect(localStorage.lastCameraId).toEqual(device.deviceId)
    expect(currentCameraReceived).toHaveBeenCalledTimes(1)
    expect(currentCameraReceived).toHaveBeenCalledWith(device)
    currentCameraReceived.mockClear()
  }
})
