import { Observable } from '@babylonjs/core/Misc/observable'
import { faker } from '@faker-js/faker'
import { get } from 'svelte/store'
import { createEngine } from '../../src/3d'
import {
  cameraManager,
  controlManager,
  inputManager,
  indicatorManager,
  handManager
} from '../../src/3d/managers'
import {
  connected as connectedPeers,
  lastMessageReceived,
  send as sendToPeer
} from '../../src/stores/peer-channels'
import * as gameEngine from '../../src/stores/game-engine'
import { configures3dTestEngine, sleep } from '../test-utils'

jest.mock('../../src/3d')
jest.mock('../../src/stores/peer-channels', () => {
  const { BehaviorSubject, Subject } = require('rxjs')
  return {
    send: jest.fn(),
    connected: new BehaviorSubject(),
    lastMessageReceived: new Subject({})
  }
})

let saveCamera
let restoreCamera
let loadCameraSaves
let registerPointerIndicator
let pruneUnusedPointers
let handManagerApplyDraw

beforeAll(() => {
  saveCamera = jest.spyOn(cameraManager, 'save')
  restoreCamera = jest.spyOn(cameraManager, 'restore')
  loadCameraSaves = jest.spyOn(cameraManager, 'loadSaves')
  registerPointerIndicator = jest.spyOn(
    indicatorManager,
    'registerPointerIndicator'
  )
  pruneUnusedPointers = jest.spyOn(indicatorManager, 'pruneUnusedPointers')
  handManagerApplyDraw = jest.spyOn(handManager, 'applyDraw')
})

beforeEach(jest.resetAllMocks)

describe('initEngine()', () => {
  let subscriptions
  let scene
  let handScene
  const canvas = document.createElement('canvas')
  const interaction = document.createElement('div')
  const overlay = document.createElement('div')
  const receiveAction = jest.fn()
  const receiveMeshDetail = jest.fn()
  const receiveCameraSave = jest.fn()
  const receiveCurrentCamera = jest.fn()
  const receiveLongInput = jest.fn()
  const receiveHandChange = jest.fn()
  const receiveHighlightHand = jest.fn()
  const receiveHandVisible = jest.fn()

  configures3dTestEngine(created => {
    scene = created.scene
    handScene = created.handScene
  })

  beforeAll(async () => {
    subscriptions = [
      gameEngine.action.subscribe({ next: receiveAction }),
      gameEngine.meshDetails.subscribe({ next: receiveMeshDetail }),
      gameEngine.cameraSaves.subscribe({ next: receiveCameraSave }),
      gameEngine.currentCamera.subscribe({ next: receiveCurrentCamera }),
      gameEngine.longInputs.subscribe({ next: receiveLongInput }),
      gameEngine.handMeshes.subscribe({ next: receiveHandChange }),
      gameEngine.highlightHand.subscribe({ next: receiveHighlightHand }),
      gameEngine.handVisible.subscribe({ next: receiveHandVisible })
    ]
  })

  afterAll(() => subscriptions.forEach(sub => sub.unsubscribe()))

  describe('given an engine', () => {
    let engine

    beforeEach(() => {
      engine = create3DEngineMock()
      createEngine.mockReturnValueOnce(engine)
      engine.serialize = jest.fn()
    })

    afterEach(() => {
      engine.onDisposeObservable.notifyObservers()
    })

    it('configures and starts an engine', () => {
      const created = gameEngine.initEngine({ canvas, interaction })
      expect(engine.start).toHaveBeenCalledTimes(1)
      expect(get(gameEngine.engine)).toEqual(engine)
      expect(created).toEqual(engine)
      expect(receiveHandVisible).not.toHaveBeenCalled()
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

      it('sends scene actions to peers', () => {
        const data = { foo: faker.datatype.uuid() }
        controlManager.onActionObservable.notifyObservers(data)
        expect(receiveAction).toHaveBeenCalledWith(data)
        expect(receiveAction).toHaveBeenCalledTimes(1)
        expect(sendToPeer).toHaveBeenCalledWith(data)
        expect(sendToPeer).toHaveBeenCalledTimes(1)
      })

      it('does not send hand actions to peers', () => {
        const data = { foo: faker.datatype.uuid(), fromHand: true }
        controlManager.onActionObservable.notifyObservers(data)
        expect(receiveAction).toHaveBeenCalledWith(data)
        expect(receiveAction).toHaveBeenCalledTimes(1)
        expect(sendToPeer).not.toHaveBeenCalled()
      })

      it('moves peer pointers on message', () => {
        expect(registerPointerIndicator).not.toHaveBeenCalled()
        const playerId = faker.datatype.uuid()
        const pointer = [
          faker.datatype.number({ min: 0, max: 800 }),
          0,
          faker.datatype.number({ min: 0, max: 800 })
        ]
        lastMessageReceived.next({ data: { pointer }, playerId })
        expect(registerPointerIndicator).toHaveBeenCalledWith(playerId, pointer)
        expect(registerPointerIndicator).toHaveBeenCalledTimes(1)
      })

      it('handles peer draw actions', () => {
        const playerId = faker.datatype.uuid()
        const state = { foo: 'bar' }
        const action = {
          meshId: faker.datatype.uuid(),
          fn: 'draw',
          args: [state]
        }
        lastMessageReceived.next({ data: action, playerId })
        expect(handManagerApplyDraw).toHaveBeenCalledWith(state, playerId)
        expect(handManagerApplyDraw).toHaveBeenCalledTimes(1)
        expect(receiveAction).toHaveBeenCalledWith({
          ...action,
          peerId: playerId
        })
        expect(receiveAction).toHaveBeenCalledTimes(1)
        expect(sendToPeer).not.toHaveBeenCalled()
      })

      it('ignores other peer messages', () => {
        lastMessageReceived.next({ data: { foo: 'bar' } })
        expect(handManagerApplyDraw).not.toHaveBeenCalled()
        expect(receiveAction).not.toHaveBeenCalled()
        expect(sendToPeer).not.toHaveBeenCalled()
        expect(registerPointerIndicator).not.toHaveBeenCalled()
      })

      it('receives peer actions', () => {
        const meshId = faker.datatype.uuid()
        lastMessageReceived.next({ data: { meshId } })
        expect(receiveAction).toHaveBeenCalledWith({ meshId })
        expect(receiveAction).toHaveBeenCalledTimes(1)
        expect(handManagerApplyDraw).not.toHaveBeenCalled()
        expect(sendToPeer).not.toHaveBeenCalled()
      })

      it('regularly send pointer events to peers', async () => {
        expect(sendToPeer).not.toHaveBeenCalled()
        const data1 = { foo: 1 }
        const data2 = { foo: 2 }
        inputManager.onPointerObservable.notifyObservers(data1)
        expect(sendToPeer).not.toHaveBeenCalled()
        inputManager.onPointerObservable.notifyObservers(data2)
        await sleep(5)
        expect(sendToPeer).not.toHaveBeenCalled()
        await sleep(30)
        expect(sendToPeer).toHaveBeenCalledWith({ pointer: data2 })
        expect(sendToPeer).toHaveBeenCalledTimes(1)
      })

      it('proxies mesh detail events', () => {
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
        const data = { foo: faker.datatype.uuid() }
        inputManager.onLongObservable.notifyObservers(data)
        expect(receiveLongInput).toHaveBeenCalledWith(data)
        expect(receiveLongInput).toHaveBeenCalledTimes(1)
      })

      it('proxies hand change events', () => {
        const handMeshes = [{ foo: faker.datatype.uuid() }]
        engine.serialize.mockReturnValueOnce({ handMeshes })
        handManager.onHandChangeObservable.notifyObservers()
        expect(receiveHandChange).toHaveBeenCalledWith(handMeshes)
        expect(receiveHandChange).toHaveBeenCalledTimes(1)
      })

      it('proxies hand highlight events', () => {
        const highlight = faker.datatype.boolean()
        handManager.onDraggableToHandObservable.notifyObservers(highlight)
        expect(receiveHighlightHand).toHaveBeenCalledWith(highlight)
        expect(receiveHighlightHand).toHaveBeenCalledTimes(1)
      })

      it('prunes peer pointers on connection', () => {
        expect(pruneUnusedPointers).not.toHaveBeenCalled()
        const id1 = 1
        const id2 = 2
        const id3 = 3
        connectedPeers.next([{ playerId: id1 }, { playerId: id3 }])
        expect(pruneUnusedPointers).toHaveBeenCalledWith([id1, id3])
        connectedPeers.next([{ playerId: id1 }, { playerId: id2 }])
        expect(pruneUnusedPointers).toHaveBeenNthCalledWith(2, [id1, id2])
        expect(pruneUnusedPointers).toHaveBeenCalledTimes(2)
      })

      it('exposes hand manager enability', () => {
        expect(receiveHandVisible).not.toHaveBeenCalled()
        handManager.init({ scene, handScene, overlay })
        engine.onLoadingObservable.notifyObservers(false)
        expect(receiveHandVisible).toHaveBeenNthCalledWith(1, true)
        scene.getEngine().dispose()
        engine.onLoadingObservable.notifyObservers(false)
        expect(receiveHandVisible).toHaveBeenNthCalledWith(2, false)
        expect(receiveHandVisible).toHaveBeenCalledTimes(2)
      })
    })
  })
})

describe('saveCamera()', () => {
  it('invokes camera manager', () => {
    const args = ['foo', 'bar']
    gameEngine.saveCamera(...args)
    expect(saveCamera).toHaveBeenCalledWith(...args)
    expect(saveCamera).toHaveBeenCalledTimes(1)
    expect(restoreCamera).not.toHaveBeenCalled()
    expect(loadCameraSaves).not.toHaveBeenCalled()
  })
})

describe('restoreCamera()', () => {
  it('invokes camera manager', () => {
    const args = ['foo', 'bar']
    gameEngine.restoreCamera(...args)
    expect(restoreCamera).toHaveBeenCalledWith(...args)
    expect(restoreCamera).toHaveBeenCalledTimes(1)
    expect(saveCamera).not.toHaveBeenCalled()
    expect(loadCameraSaves).not.toHaveBeenCalled()
  })
})

describe('loadCameraSaves()', () => {
  it('invokes camera manager', () => {
    const args = ['foo', 'bar']
    gameEngine.loadCameraSaves(...args)
    expect(loadCameraSaves).toHaveBeenCalledWith(...args)
    expect(loadCameraSaves).toHaveBeenCalledTimes(1)
    expect(saveCamera).not.toHaveBeenCalled()
    expect(restoreCamera).not.toHaveBeenCalled()
  })
})

function create3DEngineMock() {
  return {
    onEndFrameObservable: new Observable(),
    onDisposeObservable: new Observable(),
    onLoadingObservable: new Observable(),
    getFps: jest.fn(),
    start: jest.fn()
  }
}
