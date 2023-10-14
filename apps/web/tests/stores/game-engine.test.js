// @ts-check
import { Observable } from '@babylonjs/core/Misc/observable'
import { faker } from '@faker-js/faker'
import { createEngine } from '@src/3d'
import * as gameEngine from '@src/stores/game-engine'
import {
  connected,
  lastDisconnectedId as originalLastDisconnectedId,
  lastMessageReceived as originalLastMessage,
  send
} from '@src/stores/peer-channels'
import { configures3dTestEngine, sleep } from '@tests/test-utils'
import { get } from 'svelte/store'
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

vi.mock('@src/3d')
vi.mock('@src/stores/peer-channels', () => {
  const { BehaviorSubject, Subject } = require('rxjs')
  return {
    send: vi.fn(),
    connected: new BehaviorSubject(undefined),
    lastMessageReceived: new Subject(),
    lastDisconnectedId: new Subject()
  }
})

/** @type {import('vitest').Spy<import('@src/3d/managers').CameraManager['save']>} */
let saveCamera
/** @type {import('vitest').Spy<import('@src/3d/managers').CameraManager['restore']>} */
let restoreCamera
/** @type {import('vitest').Spy<import('@src/3d/managers').CameraManager['loadSaves']>} */
let loadCameraSaves
/** @type {import('vitest').Spy<import('@src/3d/managers').IndicatorManager['registerPointerIndicator']>} */
let registerPointerIndicator
/** @type {import('vitest').Spy<import('@src/3d/managers').IndicatorManager['pruneUnusedPointers']>} */
let pruneUnusedPointers
/** @type {import('vitest').Spy<import('@src/3d/managers').ControlManager['apply']>} */
let applyAction
/** @type {import('vitest').Spy<import('@src/3d/managers').ReplayManager['replayHistory']>} */
let replayHistory

beforeEach(() => {
  vi.resetAllMocks()
})

describe('initEngine()', () => {
  /** @type {import('rxjs').Subscription[]} */
  let subscriptions
  /** @type {import('@babylonjs/core').Scene} */
  let scene
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  const canvas = document.createElement('canvas')
  const interaction = document.createElement('div')
  const hand = document.createElement('div')
  const receiveAction = vi.fn()
  const receiveSelection = vi.fn()
  const receiveMeshDetail = vi.fn()
  const receiveCameraSave = vi.fn()
  const receiveCurrentCamera = vi.fn()
  const receiveLongInput = vi.fn()
  const receiveHandChange = vi.fn()
  const receiveHandCount = vi.fn()
  const receiveHighlightHand = vi.fn()
  const receiveHandVisible = vi.fn()
  const receiveRemoteSelection = vi.fn()
  const receiveHistory = vi.fn()
  const receiveReplayRank = vi.fn()
  const receiveScores = vi.fn()
  const sendToPeer = /** @type {import('vitest').FunctionMock<send>} */ (send)
  const lastMessageReceived =
    /** @type {import('rxjs').Subject<import('@src/stores').WebRTCMessage>} */ (
      originalLastMessage
    )
  const lastDisconnectedId = /** @type {import('rxjs').Subject<string>} */ (
    originalLastDisconnectedId
  )
  const connectedPeers =
    /** @type {import('rxjs').BehaviorSubject<import('@src/stores').Connected[]>} */ (
      connected
    )

  configures3dTestEngine(created => {
    scene = created.scene
    managers = created.managers
    saveCamera = vi.spyOn(managers.camera, 'save')
    restoreCamera = vi.spyOn(managers.camera, 'restore')
    loadCameraSaves = vi.spyOn(managers.camera, 'loadSaves')
    registerPointerIndicator = vi.spyOn(
      managers.indicator,
      'registerPointerIndicator'
    )
    pruneUnusedPointers = vi.spyOn(managers.indicator, 'pruneUnusedPointers')
    applyAction = vi.spyOn(managers.control, 'apply')
    replayHistory = vi.spyOn(managers.replay, 'replayHistory')
    subscriptions = [
      gameEngine.action.subscribe({ next: receiveAction }),
      gameEngine.meshDetails.subscribe({ next: receiveMeshDetail }),
      gameEngine.cameraSaves.subscribe({ next: receiveCameraSave }),
      gameEngine.currentCamera.subscribe({ next: receiveCurrentCamera }),
      gameEngine.longInputs.subscribe({ next: receiveLongInput }),
      gameEngine.handMeshes.subscribe({ next: receiveHandChange }),
      gameEngine.handMeshCount.subscribe({ next: receiveHandCount }),
      gameEngine.highlightHand.subscribe({ next: receiveHighlightHand }),
      gameEngine.handVisible.subscribe({ next: receiveHandVisible }),
      gameEngine.selectedMeshes.subscribe({ next: receiveSelection }),
      gameEngine.remoteSelection.subscribe({ next: receiveRemoteSelection }),
      gameEngine.history.subscribe({ next: receiveHistory }),
      gameEngine.replayRank.subscribe({ next: receiveReplayRank }),
      gameEngine.scores.subscribe({ next: receiveScores })
    ]
  })

  afterAll(() => subscriptions.forEach(sub => sub.unsubscribe()))

  describe('given an engine', () => {
    /** @type {import('vitest').MockedObject<import('@babylonjs/core').Engine>} */
    let engine

    beforeEach(() => {
      engine = create3DEngineMock()
      const createEngineMock =
        /** @type {import('vitest').FunctionMock<createEngine>} */ (
          createEngine
        )
      createEngineMock.mockReturnValue(engine)
    })

    afterEach(() => {
      engine.onDisposeObservable.notifyObservers(engine)
    })

    it('configures and starts an engine', () => {
      const created = gameEngine.initEngine({
        canvas,
        interaction,
        hand,
        pointerThrottle: 10,
        longTapDelay: 100
      })
      expect(engine.start).toHaveBeenCalledOnce()
      expect(get(gameEngine.engine)).toEqual(engine)
      expect(created).toEqual(engine)
      expect(receiveHandVisible).not.toHaveBeenCalled()
    })

    describe('given an initialized engine', () => {
      beforeEach(() => {
        gameEngine.initEngine({
          canvas,
          interaction,
          hand,
          pointerThrottle: 10,
          longTapDelay: 100
        })
        sendToPeer.mockReset()
      })

      it('reset engine observable on disposal', () => {
        engine.onDisposeObservable.notifyObservers(engine)
        expect(get(gameEngine.engine)).toBeNull()
        expect(receiveHistory).toHaveBeenCalledWith([])
        expect(receiveHistory).toHaveBeenCalledOnce()
        expect(receiveReplayRank).toHaveBeenCalledWith(0)
        expect(receiveReplayRank).toHaveBeenCalledOnce()
      })

      it('updates FPS on event', () => {
        let fps1 = faker.number.int(999)
        let fps2 = faker.number.int(999)
        engine.getFps.mockReturnValueOnce(fps1).mockReturnValueOnce(fps2)

        engine.onEndFrameObservable.notifyObservers(engine)
        expect(get(gameEngine.fps)).toEqual(fps1.toFixed())

        engine.onEndFrameObservable.notifyObservers(engine)
        expect(get(gameEngine.fps)).toEqual(fps2.toFixed())
      })

      it('sends scene actions to peers', () => {
        /** @type {import('@tabulous/types').Action} */
        const data = {
          fn: 'pop',
          args: [],
          meshId: faker.string.uuid(),
          fromHand: false
        }
        managers.control.onActionObservable.notifyObservers(data)
        expect(receiveAction).toHaveBeenCalledWith(data)
        expect(receiveAction).toHaveBeenCalledOnce()
        expect(sendToPeer).toHaveBeenCalledWith(data)
        expect(sendToPeer).toHaveBeenCalledOnce()
        expect(applyAction).not.toHaveBeenCalled()
      })

      it('does not send local actions to peers', () => {
        /** @type {import('@tabulous/types').Action} */
        const data = {
          fn: 'pop',
          args: [],
          meshId: faker.string.uuid(),
          fromHand: false,
          isLocal: true
        }
        managers.control.onActionObservable.notifyObservers(data)
        expect(receiveAction).toHaveBeenCalledWith(data)
        expect(receiveAction).toHaveBeenCalledOnce()
        expect(sendToPeer).not.toHaveBeenCalled()
        expect(applyAction).not.toHaveBeenCalled()
      })

      it('does not send hand actions to peers', () => {
        /** @type {import('@tabulous/types').Action} */
        const data = {
          fn: 'pop',
          args: [],
          meshId: faker.string.uuid(),
          fromHand: true
        }
        managers.control.onActionObservable.notifyObservers(data)
        expect(receiveAction).toHaveBeenCalledWith(data)
        expect(receiveAction).toHaveBeenCalledOnce()
        expect(sendToPeer).not.toHaveBeenCalled()
        expect(applyAction).not.toHaveBeenCalled()
      })

      it('sends selection to peers', () => {
        const data = /** @type {Set<import('@babylonjs/core').Mesh>} */ (
          new Set([{ id: 'mesh1' }, { id: 'mesh2' }])
        )
        managers.selection.onSelectionObservable.notifyObservers(data)
        expect(receiveSelection).toHaveBeenNthCalledWith(1, data)
        expect(sendToPeer).toHaveBeenNthCalledWith(1, {
          selectedIds: ['mesh1', 'mesh2']
        })

        managers.selection.onSelectionObservable.notifyObservers(new Set())
        expect(receiveSelection).toHaveBeenNthCalledWith(2, new Set())
        expect(sendToPeer).toHaveBeenNthCalledWith(2, { selectedIds: [] })
        expect(receiveSelection).toHaveBeenCalledTimes(2)
        expect(sendToPeer).toHaveBeenCalledTimes(2)
        expect(receiveRemoteSelection).not.toHaveBeenCalled()
        expect(applyAction).not.toHaveBeenCalled()
      })

      it('handles remote selection', () => {
        const playerId = faker.string.uuid()
        const selectedIds = ['mesh1', 'mesh2']
        lastMessageReceived.next({ data: { selectedIds }, playerId })

        expect(receiveSelection).not.toHaveBeenCalled()
        expect(receiveRemoteSelection).toHaveBeenCalledWith({
          playerId,
          selectedIds
        })
        expect(receiveRemoteSelection).toHaveBeenCalledOnce()
        expect(applyAction).not.toHaveBeenCalled()
      })

      it('clears remote selection on peer disconnection', () => {
        const playerId = faker.string.uuid()
        lastDisconnectedId.next(playerId)

        expect(receiveSelection).not.toHaveBeenCalled()
        expect(receiveRemoteSelection).toHaveBeenCalledWith({
          playerId,
          selectedIds: []
        })
        expect(receiveRemoteSelection).toHaveBeenCalledOnce()
        expect(applyAction).not.toHaveBeenCalled()
      })

      it('moves peer pointers on message', () => {
        expect(registerPointerIndicator).not.toHaveBeenCalled()
        const playerId = faker.string.uuid()
        const pointer = [
          faker.number.int({ min: 0, max: 800 }),
          0,
          faker.number.int({ min: 0, max: 800 })
        ]
        lastMessageReceived.next({ data: { pointer }, playerId })
        expect(registerPointerIndicator).toHaveBeenCalledWith(playerId, pointer)
        expect(registerPointerIndicator).toHaveBeenCalledOnce()
        expect(applyAction).not.toHaveBeenCalled()
      })

      it('ignores other peer messages', () => {
        lastMessageReceived.next({ data: { foo: 'bar' }, playerId: 'foo' })
        expect(receiveAction).not.toHaveBeenCalled()
        expect(sendToPeer).not.toHaveBeenCalled()
        expect(registerPointerIndicator).not.toHaveBeenCalled()
        expect(applyAction).not.toHaveBeenCalled()
      })

      it('receives peer actions', () => {
        const playerId = faker.person.firstName()
        const data = {
          meshId: faker.string.uuid(),
          fn: 'flip',
          args: [],
          fromHand: false
        }
        lastMessageReceived.next({ data, playerId })
        expect(receiveAction).toHaveBeenCalledWith({
          ...data,
          peerId: playerId
        })
        expect(receiveAction).toHaveBeenCalledOnce()
        expect(sendToPeer).not.toHaveBeenCalled()
        expect(applyAction).toHaveBeenCalledWith(data)
        expect(applyAction).toHaveBeenCalledOnce()
      })

      it('regularly send pointer events to peers', async () => {
        expect(sendToPeer).not.toHaveBeenCalled()
        const data1 = [1, 1, 1]
        const data2 = [1, 1, 1]
        managers.input.onPointerObservable.notifyObservers(data1)
        expect(sendToPeer).not.toHaveBeenCalled()
        managers.input.onPointerObservable.notifyObservers(data2)
        await sleep(5)
        expect(sendToPeer).not.toHaveBeenCalled()
        await sleep(30)
        expect(sendToPeer).toHaveBeenCalledWith({ pointer: data2 })
        expect(sendToPeer).toHaveBeenCalledOnce()
        expect(applyAction).not.toHaveBeenCalled()
      })

      it('proxies mesh detail events', () => {
        /** @type {import('@src/3d/managers').MeshDetails} */
        const data = {
          position: { x: 0, y: 10 },
          images: [faker.image.avatar()]
        }
        managers.control.onDetailedObservable.notifyObservers(data)
        expect(receiveMeshDetail).toHaveBeenCalledWith(data)
        expect(receiveMeshDetail).toHaveBeenCalledOnce()
      })

      it('proxies camera save events', () => {
        receiveCameraSave.mockReset()
        const data = [
          { hash: '', target: [0, 0, 0], alpha: 1, beta: 2, elevation: 3 }
        ]
        managers.camera.onSaveObservable.notifyObservers(data)
        expect(receiveCameraSave).toHaveBeenCalledWith(data)
        expect(receiveCameraSave).toHaveBeenCalledOnce()
      })

      it('proxies current camera events', () => {
        receiveCurrentCamera.mockReset()
        const data = {
          hash: '',
          target: [0, 0, 0],
          alpha: 3,
          beta: 2,
          elevation: 1
        }
        managers.camera.onMoveObservable.notifyObservers(data)
        expect(receiveCurrentCamera).toHaveBeenCalledWith(data)
        expect(receiveCurrentCamera).toHaveBeenCalledOnce()
      })

      it('proxies long input events', () => {
        const data = { timestamp: Date.now(), type: 'longTap' }
        managers.input.onLongObservable.notifyObservers(
          /** @type {import('@src/3d/managers').LongData} */ (data)
        )
        expect(receiveLongInput).toHaveBeenCalledWith(data)
        expect(receiveLongInput).toHaveBeenCalledOnce()
      })

      it('proxies hand change events', () => {
        /** @type {import('@tabulous/types').Mesh[]} */
        const handMeshes = [{ shape: 'box', id: '1', texture: '' }]
        engine.serialize.mockReturnValueOnce({
          handMeshes,
          meshes: [],
          history: []
        })
        managers.hand.onHandChangeObservable.notifyObservers({ meshes: [] })
        expect(receiveHandChange).toHaveBeenCalledWith(handMeshes)
        expect(receiveHandChange).toHaveBeenCalledOnce()
      })

      it('proxies hand highlight events', () => {
        const highlight = faker.datatype.boolean()
        managers.hand.onDraggableToHandObservable.notifyObservers(highlight)
        expect(receiveHighlightHand).toHaveBeenCalledWith(highlight)
        expect(receiveHighlightHand).toHaveBeenCalledOnce()
      })

      it('proxies scores events', () => {
        /** @type {import('@tabulous/types').Scores} */
        const scores = { playerId1: { total: 10 } }
        managers.rule.onScoreUpdateObservable.notifyObservers(scores)
        expect(receiveScores).toHaveBeenNthCalledWith(1, null)
        expect(receiveScores).toHaveBeenNthCalledWith(2, scores)
        expect(receiveScores).toHaveBeenCalledTimes(2)
      })

      it('prunes peer pointers on connection', () => {
        expect(pruneUnusedPointers).not.toHaveBeenCalled()
        const id1 = '1'
        const id2 = '2'
        const id3 = '3'
        connectedPeers.next([{ playerId: id1 }, { playerId: id3 }])
        expect(pruneUnusedPointers).toHaveBeenCalledWith([id1, id3])
        connectedPeers.next([{ playerId: id1 }, { playerId: id2 }])
        expect(pruneUnusedPointers).toHaveBeenNthCalledWith(2, [id1, id2])
        expect(pruneUnusedPointers).toHaveBeenCalledTimes(2)
      })

      it('exposes hand manager enability', () => {
        expect(receiveHandVisible).not.toHaveBeenCalled()
        engine.managers.hand.enabled = true
        engine.onLoadingObservable.notifyObservers(false)
        expect(receiveHandVisible).toHaveBeenNthCalledWith(1, true)
        scene.getEngine().dispose()
        engine.onLoadingObservable.notifyObservers(false)
        expect(receiveHandVisible).toHaveBeenNthCalledWith(2, false)
        expect(receiveHandVisible).toHaveBeenCalledTimes(2)
      })

      describe('saveCamera()', () => {
        it('invokes camera manager', () => {
          const args = [2]
          gameEngine.saveCamera(...args)
          expect(saveCamera).toHaveBeenCalledWith(...args)
          expect(saveCamera).toHaveBeenCalledOnce()
          expect(restoreCamera).not.toHaveBeenCalled()
          expect(loadCameraSaves).not.toHaveBeenCalled()
        })
      })

      describe('restoreCamera()', () => {
        it('invokes camera manager', () => {
          const args = [4]
          gameEngine.restoreCamera(...args)
          expect(restoreCamera).toHaveBeenCalledWith(...args)
          expect(restoreCamera).toHaveBeenCalledOnce()
          expect(saveCamera).not.toHaveBeenCalled()
          expect(loadCameraSaves).not.toHaveBeenCalled()
        })
      })

      describe('loadCameraSaves()', () => {
        it('invokes camera manager', () => {
          const args = [
            { hash: '', target: [0, 0, 0], alpha: 1, beta: 2, elevation: 3 }
          ]
          gameEngine.loadCameraSaves(args)
          expect(loadCameraSaves).toHaveBeenCalledWith(args)
          expect(loadCameraSaves).toHaveBeenCalledOnce()
          expect(saveCamera).not.toHaveBeenCalled()
        })
      })

      describe('replayHistory()', () => {
        it('invokes replay manager', async () => {
          managers.replay.engine = engine
          await gameEngine.replayHistory(5)
          expect(replayHistory).toHaveBeenCalledWith(5)
          expect(replayHistory).toHaveBeenCalledOnce()
        })
      })
    })
  })

  function create3DEngineMock() {
    return /** @type {import('vitest').MockedObject<import('@babylonjs/core').Engine>} */ ({
      applyRemoteAction: (...args) => managers.control.apply(args[0]),
      applyRemoteSelection: managers.selection.apply.bind(managers.selection),
      getFps: vi.fn(),
      load: vi.fn(),
      managers,
      onEndFrameObservable: new Observable(),
      onDisposeObservable: new Observable(),
      onLoadingObservable: new Observable(),
      serialize: vi.fn(),
      start: vi.fn()
    })
  }
})
