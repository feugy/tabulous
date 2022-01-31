import { Observable } from '@babylonjs/core/Misc/observable'
import * as faker from 'faker'
import { get } from 'svelte/store'
import { createEngine, createTable, createLight } from '../../src/3d'
import {
  cameraManager,
  controlManager,
  inputManager
} from '../../src/3d/managers'
import {
  connected as connectedPeers,
  lastMessageReceived,
  send as sendToPeer
} from '../../src/stores/peer-channels'
import * as gameEngine from '../../src/stores/game-engine'
import { sleep } from '../test-utils'

jest.mock('../../src/3d')
jest.mock('../../src/stores/peer-channels', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    send: jest.fn(),
    connected: new BehaviorSubject(),
    lastMessageReceived: new BehaviorSubject({})
  }
})

let cameraManagerSave
let cameraManagerRestore
let cameraManagerLoadSaves
let controlManagerMovePointer
let controlManagerPruneUnused

beforeAll(() => {
  cameraManagerSave = jest.spyOn(cameraManager, 'save')
  cameraManagerRestore = jest.spyOn(cameraManager, 'restore')
  cameraManagerLoadSaves = jest.spyOn(cameraManager, 'loadSaves')
  controlManagerMovePointer = jest.spyOn(controlManager, 'movePeerPointer')
  controlManagerPruneUnused = jest.spyOn(
    controlManager,
    'pruneUnusedPeerPointers'
  )
})

beforeEach(jest.resetAllMocks)

describe('initEngine()', () => {
  let subscriptions
  const canvas = document.createElement('canvas')
  const interaction = document.createElement('div')
  const receiveAction = jest.fn()
  const receiveMeshDetail = jest.fn()
  const receiveCameraSave = jest.fn()
  const receiveCurrentCamera = jest.fn()
  const receiveLongInput = jest.fn()

  beforeAll(async () => {
    subscriptions = [
      gameEngine.action.subscribe({ next: receiveAction }),
      gameEngine.meshDetails.subscribe({ next: receiveMeshDetail }),
      gameEngine.cameraSaves.subscribe({ next: receiveCameraSave }),
      gameEngine.currentCamera.subscribe({ next: receiveCurrentCamera }),
      gameEngine.longInputs.subscribe({ next: receiveLongInput })
    ]
  })

  afterAll(() => subscriptions.forEach(sub => sub.unsubscribe()))

  describe('given an engine', () => {
    let engine

    beforeEach(() => {
      engine = create3DEngineMock()
      createEngine.mockReturnValueOnce(engine)
    })

    afterEach(() => {
      engine.onDisposeObservable.notifyObservers()
    })

    it('configures and starts an engine', () => {
      gameEngine.initEngine({ canvas, interaction })
      expect(engine.start).toHaveBeenCalledTimes(1)
      expect(createTable).toHaveBeenCalledTimes(1)
      expect(createLight).toHaveBeenCalledTimes(1)
      expect(get(gameEngine.engine)).toEqual(engine)
    })

    describe('given an initialized engine', () => {
      beforeEach(() => {
        gameEngine.initEngine({ canvas, interaction, pointerThrottle: 10 })
      })

      it('reset engine observable on disposal', () => {
        engine.onDisposeObservable.notifyObservers()
        expect(get(gameEngine.engine)).toBeNull()
      })

      it('updates FPS on event', () => {
        let fps1 = faker.datatype.number()
        let fps2 = faker.datatype.number()
        engine.getFps.mockReturnValueOnce(fps1).mockReturnValueOnce(fps2)

        engine.onEndFrameObservable.notifyObservers()
        expect(get(gameEngine.fps)).toEqual(fps1.toFixed())

        engine.onEndFrameObservable.notifyObservers()
        expect(get(gameEngine.fps)).toEqual(fps2.toFixed())
      })

      it('proxies action events', () => {
        expect(receiveAction).not.toHaveBeenCalled()
        const data = { foo: faker.datatype.uuid() }
        controlManager.onActionObservable.notifyObservers(data)
        expect(receiveAction).toHaveBeenCalledWith(data)
        expect(receiveAction).toHaveBeenCalledTimes(1)
        expect(sendToPeer).toHaveBeenCalledWith(data)
        expect(sendToPeer).toHaveBeenCalledTimes(1)
      })

      it('moves peer pointers on message', () => {
        expect(controlManagerMovePointer).not.toHaveBeenCalled()
        const pointer = faker.datatype.uuid()
        lastMessageReceived.next({ data: { pointer } })
        expect(controlManagerMovePointer).toHaveBeenCalledWith({ pointer })
        expect(controlManagerMovePointer).toHaveBeenCalledTimes(1)
      })

      it('receives peer actions', () => {
        expect(receiveAction).not.toHaveBeenCalled()
        const meshId = faker.datatype.uuid()
        lastMessageReceived.next({ data: { meshId } })
        expect(receiveAction).toHaveBeenCalledWith({ meshId })
        expect(receiveAction).toHaveBeenCalledTimes(1)
        expect(sendToPeer).not.toHaveBeenCalled()
      })

      it('regularly send pointer events to peers', async () => {
        expect(sendToPeer).not.toHaveBeenCalled()
        const data1 = { foo: 1 }
        const data2 = { foo: 2 }
        controlManager.onPointerObservable.notifyObservers(data1)
        expect(sendToPeer).not.toHaveBeenCalled()
        controlManager.onPointerObservable.notifyObservers(data2)
        await sleep(5)
        expect(sendToPeer).not.toHaveBeenCalled()
        await sleep(30)
        expect(sendToPeer).toHaveBeenCalledWith(data2)
        expect(sendToPeer).toHaveBeenCalledTimes(1)
      })

      it('proxies mesh detail events', () => {
        expect(receiveMeshDetail).not.toHaveBeenCalled()
        const data = { foo: faker.datatype.uuid() }
        controlManager.onDetailedObservable.notifyObservers({ data })
        expect(receiveMeshDetail).toHaveBeenCalledWith(data)
        expect(receiveMeshDetail).toHaveBeenCalledTimes(1)
      })

      it('proxies camera save events', () => {
        expect(receiveCameraSave).toHaveBeenCalledWith([])
        expect(receiveCameraSave).toHaveBeenCalledTimes(1)
        const data = { foo: faker.datatype.uuid() }
        cameraManager.onSaveObservable.notifyObservers(data)
        expect(receiveCameraSave).toHaveBeenNthCalledWith(2, data)
        expect(receiveCameraSave).toHaveBeenCalledTimes(2)
      })

      it('proxies current camera events', () => {
        expect(receiveCurrentCamera).toHaveBeenCalledWith(undefined)
        expect(receiveCurrentCamera).toHaveBeenCalledTimes(1)
        const data = { foo: faker.datatype.uuid() }
        cameraManager.onMoveObservable.notifyObservers(data)
        expect(receiveCurrentCamera).toHaveBeenNthCalledWith(2, data)
        expect(receiveCurrentCamera).toHaveBeenCalledTimes(2)
      })

      it('proxies long input events', () => {
        expect(receiveLongInput).not.toHaveBeenCalled()
        const data = { foo: faker.datatype.uuid() }
        inputManager.onLongObservable.notifyObservers(data)
        expect(receiveLongInput).toHaveBeenCalledWith(data)
        expect(receiveLongInput).toHaveBeenCalledTimes(1)
      })

      it('prunes peer pointers on conection', () => {
        expect(controlManagerPruneUnused).not.toHaveBeenCalled()
        const id1 = 1
        const id2 = 2
        const id3 = 3
        connectedPeers.next([{ playerId: id1 }, { playerId: id3 }])
        expect(controlManagerPruneUnused).toHaveBeenCalledWith([id1, id3])
        connectedPeers.next([{ playerId: id1 }, { playerId: id2 }])
        expect(controlManagerPruneUnused).toHaveBeenNthCalledWith(2, [id1, id2])
        expect(controlManagerPruneUnused).toHaveBeenCalledTimes(2)
      })
    })
  })
})

describe('saveCamera()', () => {
  it('invokes camera manager', () => {
    const args = ['foo', 'bar']
    gameEngine.saveCamera(...args)
    expect(cameraManagerSave).toHaveBeenCalledWith(...args)
    expect(cameraManagerSave).toHaveBeenCalledTimes(1)
    expect(cameraManagerRestore).not.toHaveBeenCalled()
    expect(cameraManagerLoadSaves).not.toHaveBeenCalled()
  })
})

describe('restoreCamera()', () => {
  it('invokes camera manager', () => {
    const args = ['foo', 'bar']
    gameEngine.restoreCamera(...args)
    expect(cameraManagerRestore).toHaveBeenCalledWith(...args)
    expect(cameraManagerRestore).toHaveBeenCalledTimes(1)
    expect(cameraManagerSave).not.toHaveBeenCalled()
    expect(cameraManagerLoadSaves).not.toHaveBeenCalled()
  })
})

describe('loadCameraSaves()', () => {
  it('invokes camera manager', () => {
    const args = ['foo', 'bar']
    gameEngine.loadCameraSaves(...args)
    expect(cameraManagerLoadSaves).toHaveBeenCalledWith(...args)
    expect(cameraManagerLoadSaves).toHaveBeenCalledTimes(1)
    expect(cameraManagerSave).not.toHaveBeenCalled()
    expect(cameraManagerRestore).not.toHaveBeenCalled()
  })
})

function create3DEngineMock() {
  return {
    onEndFrameObservable: new Observable(),
    onDisposeObservable: new Observable(),
    getFps: jest.fn(),
    start: jest.fn()
  }
}
