import { Observable } from '@babylonjs/core/Misc/observable'
import { faker } from '@faker-js/faker'
import { Subject } from 'rxjs'
import { get } from 'svelte/store'
import * as graphQL from '../../src/graphql'
import { loadThread, serializeThread } from '../../src/stores/discussion'
import {
  action,
  cameraSaves,
  engine as engine$,
  handMeshes as handMeshes$,
  loadCameraSaves
} from '../../src/stores/game-engine'
import {
  createGame,
  deleteGame,
  gamePlayerById,
  invite,
  listGames,
  loadGame,
  receiveGameListUpdates
} from '../../src/stores/game-manager'
import {
  runQuery,
  runMutation,
  runSubscription
} from '../../src/stores/graphql-client'
import {
  closeChannels,
  connectWith,
  lastConnectedId,
  lastDisconnectedId,
  lastMessageReceived,
  lastMessageSent,
  openChannels,
  send
} from '../../src/stores/peer-channels'
import { makeLogger } from '../../src/utils'

vi.mock('../../src/stores/graphql-client')
vi.mock('../../src/stores/game-engine', () => {
  const { BehaviorSubject, Subject } = require('rxjs')
  return {
    action: new Subject(),
    cameraSaves: new Subject(),
    handMeshes: new Subject(),
    engine: new BehaviorSubject(),
    loadCameraSaves: vi.fn()
  }
})
vi.mock('../../src/stores/peer-channels', () => {
  const { Subject } = require('rxjs')
  return {
    closeChannels: vi.fn(),
    connectWith: vi.fn(),
    lastConnectedId: new Subject(),
    lastDisconnectedId: new Subject(),
    lastMessageReceived: new Subject({}),
    lastMessageSent: new Subject({}),
    send: vi.fn(),
    openChannels: vi.fn()
  }
})
vi.mock('../../src/stores/discussion')
vi.mock('../../src/3d/utils')

const logger = makeLogger('game-manager')
const gamePlayerByIdReceived = vi.fn()
const turnCredentials = { turn: 'credentials' }
const engine = {
  scenes: [],
  load: vi.fn().mockResolvedValueOnce(),
  serialize: vi.fn().mockReturnValue({}),
  onDisposeObservable: new Observable()
}
let subscription
let warn
let error

beforeAll(() => {
  subscription = gamePlayerById.subscribe(gamePlayerByIdReceived)
})

beforeEach(() => {
  vi.resetAllMocks()
  loadCameraSaves.mockImplementation(data => cameraSaves.next(data))
  warn = vi.spyOn(logger, 'warn')
  error = vi.spyOn(logger, 'error')
})

afterAll(() => subscription.unsubscribe())

it('loadGame() does nothing without engine', async () => {
  warn.mockImplementationOnce(() => {})
  await loadGame(faker.datatype.uuid(), {
    player: { id: faker.datatype.uuid() },
    turnCredentials
  })
  expect(warn).toHaveBeenCalledTimes(1)
  expect(runQuery).not.toHaveBeenCalled()
  expect(runSubscription).not.toHaveBeenCalled()
  expect(engine.load).not.toHaveBeenCalled()
  expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(0)
})

describe('given a mocked game engine', () => {
  const gameUpdates$ = new Subject()

  beforeAll(() => engine$.next(engine))

  afterEach(() => {
    engine.onDisposeObservable.notifyObservers()
    engine.onDisposeObservable.clear()
  })

  describe('loadGame()', () => {
    const player = {
      id: faker.datatype.uuid(),
      username: faker.name.firstName()
    }
    const partner1 = {
      id: faker.datatype.uuid(),
      username: faker.name.firstName()
    }
    const partner2 = {
      id: faker.datatype.uuid(),
      username: faker.name.firstName()
    }

    beforeEach(() => {
      runSubscription.mockReturnValue(new Subject())
    })

    it('loads game data into the game engine', async () => {
      const gameId = faker.datatype.uuid()
      const meshes = [{ id: 'mesh1' }]
      const hands = [
        { playerId: 'anotherPlayerId', meshes: [{ id: 'mesh2' }] },
        { playerId: player.id, meshes: [{ id: 'mesh3' }] }
      ]
      const game = { id: gameId, meshes, players: [player], hands }
      engine.serialize.mockReturnValue({
        meshes,
        handMeshes: hands[1].meshes
      })
      runQuery.mockResolvedValueOnce(game)
      await loadGame(gameId, { player, turnCredentials })
      expect(runQuery).toHaveBeenCalledWith(graphQL.loadGame, { gameId }, false)
      expect(runQuery).toHaveBeenCalledTimes(1)
      expect(runSubscription).toHaveBeenCalledWith(graphQL.receiveGameUpdates, {
        gameId
      })
      expect(runSubscription).toHaveBeenCalledTimes(1)
      expect(engine.load).toHaveBeenCalledWith(game, player.id, true)
      expect(engine.load).toHaveBeenCalledTimes(1)
      expect(loadCameraSaves).not.toHaveBeenCalled()
      expect(loadThread).not.toHaveBeenCalled()
      expect(connectWith).not.toHaveBeenCalled()
      expect(send).toHaveBeenCalledWith(
        { type: 'game-sync', ...game, cameras: [] },
        undefined
      )
      expect(send).toHaveBeenCalledTimes(1)
      expect(openChannels).toHaveBeenCalledWith(player, turnCredentials)
      expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
        new Map([[player.id, { ...player, isHost: true, playing: true }]])
      )
      expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(4)
    })

    it('loads camera positions upon game loading', async () => {
      const gameId = faker.datatype.uuid()
      const meshes = [{ id: 'mesh1' }]
      const hands = [{ playerId: player.id, meshes: [] }]
      const cameras = [
        { playerId: player.id, index: 1 },
        { playerId: partner1.id, index: 0 },
        { playerId: player.id, index: 0 }
      ]
      const game = { id: gameId, meshes, players: [], hands, cameras }
      engine.serialize.mockReturnValueOnce({ meshes, handMeshes: [] })
      serializeThread.mockReturnValueOnce([])
      runQuery.mockResolvedValueOnce(game)
      await loadGame(gameId, { player, turnCredentials })
      expect(runQuery).toHaveBeenCalledWith(graphQL.loadGame, { gameId }, false)
      expect(runQuery).toHaveBeenCalledTimes(1)
      expect(engine.load).toHaveBeenCalledWith(game, player.id, true)
      expect(engine.load).toHaveBeenCalledTimes(1)
      expect(loadCameraSaves).toHaveBeenCalledWith([cameras[2], cameras[0]])
      expect(loadCameraSaves).toHaveBeenCalledTimes(1)
      expect(send).toHaveBeenCalledWith(
        {
          type: 'game-sync',
          ...game,
          messages: [],
          cameras
        },
        undefined
      )
      expect(send).toHaveBeenCalledTimes(1)
    })

    it('loads message thread upon game loading', async () => {
      const gameId = faker.datatype.uuid()
      const meshes = [{ id: 'mesh1' }]
      const hands = [{ playerId: player.id, meshes: [] }]
      const messages = ['coucou', 'yeah']
      const game = {
        id: gameId,
        meshes,
        players: [],
        hands,
        cameras: [],
        messages
      }
      engine.serialize.mockReturnValueOnce({ meshes, handMeshes: [] })
      serializeThread.mockReturnValueOnce(messages)
      runQuery.mockResolvedValueOnce(game)
      await loadGame(gameId, { player, turnCredentials })
      expect(runQuery).toHaveBeenCalledWith(graphQL.loadGame, { gameId }, false)
      expect(runQuery).toHaveBeenCalledTimes(1)
      expect(engine.load).toHaveBeenCalledWith(game, player.id, true)
      expect(engine.load).toHaveBeenCalledTimes(1)
      expect(loadCameraSaves).not.toHaveBeenCalled()
      expect(send).toHaveBeenCalledWith(
        { type: 'game-sync', ...game },
        undefined
      )
      expect(send).toHaveBeenCalledTimes(1)
    })

    it('loads game data without player hand', async () => {
      const gameId = faker.datatype.uuid()
      const meshes = [{ id: 'mesh2' }]
      const game = { id: gameId, meshes, players: [], hands: [] }
      engine.serialize.mockReturnValueOnce({ meshes, handMeshes: [] })
      runQuery.mockResolvedValueOnce(game)
      await loadGame(gameId, { player, turnCredentials })
      expect(runQuery).toHaveBeenCalledWith(graphQL.loadGame, { gameId }, false)
      expect(runQuery).toHaveBeenCalledTimes(1)
      expect(engine.load).toHaveBeenCalledWith(game, player.id, true)
      expect(engine.load).toHaveBeenCalledTimes(1)
    })

    describe('with a loaded game', () => {
      const meshes = [{ id: 'mesh1' }, { id: 'mesh2' }, { id: 'mesh3' }]
      const game = {
        id: faker.datatype.uuid(),
        meshes,
        players: [player, partner1],
        hands: [{ playerId: partner2.id, meshes: [{ id: 'mesh4' }] }],
        cameras: [
          { playerId: player.id, index: 0 },
          { playerId: partner1.id, index: 0 }
        ],
        messages: [],
        zoomSpec: { min: 4, initial: 15 },
        tableSpec: { width: 75, height: 50 }
      }

      beforeEach(async () => {
        vi.useFakeTimers()
        prepareGame(game)
        engine.serialize.mockReturnValue({
          ...game,
          meshes,
          handMeshes: []
        })
        await loadGame(game.id, { player, turnCredentials })
        vi.clearAllMocks()
        serializeThread.mockReturnValue(game.messages)
      })

      afterEach(() => vi.useRealTimers())

      it('sends game data to joining player', async () => {
        await connectPeerAndExpectGameSync(
          {
            ...game,
            hands: [...game.hands, { playerId: player.id, meshes: [] }]
          },
          partner1.id
        )
        expect(engine.serialize).toHaveBeenCalledTimes(1)
        expect(serializeThread).toHaveBeenCalledTimes(1)
        expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
          new Map([
            [player.id, { ...player, isHost: true, playing: true }],
            [partner1.id, { ...partner1, isHost: false, playing: true }]
          ])
        )
        expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(1)
        expect(runQuery).not.toHaveBeenCalled()
      })

      it('sends game data on server update', async () => {
        gameUpdates$.next(game)
        expect(engine.load).toHaveBeenCalledWith(game, player.id, false)
        expect(engine.load).toHaveBeenCalledTimes(1)
        expect(loadThread).toHaveBeenCalledTimes(1)
        expect(connectWith).not.toHaveBeenCalled()
        expect(loadCameraSaves).not.toHaveBeenCalled()
        await nextPromise()
        expect(send).toHaveBeenCalledWith(
          {
            type: 'game-sync',
            ...game,
            cameras: expect.arrayContaining(game.cameras),
            hands: [...game.hands, { playerId: player.id, meshes: [] }]
          },
          undefined
        )
        expect(send).toHaveBeenCalledTimes(1)
        expect(openChannels).not.toHaveBeenCalled()
        expect(gamePlayerByIdReceived).toHaveBeenCalledWith(
          new Map([
            [player.id, { ...player, isHost: true, playing: true }],
            [partner1.id, { ...partner1, isHost: false, playing: false }]
          ])
        )
        expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(1)
        expect(engine.serialize).toHaveBeenCalledTimes(1)
        expect(serializeThread).toHaveBeenCalledTimes(1)
        expect(runQuery).not.toHaveBeenCalled()
        expect(runSubscription).not.toHaveBeenCalled()
      })

      it('sends game data to newly invited player', async () => {
        runQuery.mockResolvedValueOnce({
          players: [player, partner1, partner2]
        })
        await connectPeerAndExpectGameSync(
          {
            ...game,
            players: [...game.players, partner2],
            hands: [...game.hands, { playerId: player.id, meshes: [] }]
          },
          partner2.id
        )
        expect(engine.serialize).toHaveBeenCalledTimes(1)
        expect(serializeThread).toHaveBeenCalledTimes(1)
        expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
          new Map([
            [player.id, { ...player, isHost: true, playing: true }],
            [partner1.id, { ...partner1, isHost: false, playing: false }],
            [partner2.id, { ...partner2, isHost: false, playing: true }]
          ])
        )
        expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(2)
      })

      it('saves game data after some actions', async () => {
        action.next({ data: {} })
        action.next({ data: {} })
        const hands = [...game.hands, { playerId: player.id, meshes: [] }]
        vi.runAllTimers()
        expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
          game: {
            ...game,
            cameras: [...game.cameras],
            hands,
            zoomSpec: undefined,
            tableSpec: undefined,
            players: undefined
          }
        })
        expect(runMutation).toHaveBeenCalledTimes(1)
        expect(engine.serialize).toHaveBeenCalledTimes(1)
        expect(send).toHaveBeenCalledWith(
          { type: 'game-sync', ...game, hands },
          undefined
        )
        expect(send).toHaveBeenCalledTimes(1)
        await connectPeerAndExpectGameSync({ ...game, hands }, partner1.id)
      })

      it('saves message thread upon reception', () => {
        const messages = ['hej!', 'hallo!!']
        lastMessageReceived.next({
          data: { type: 'message', message: messages[0] }
        })
        lastMessageReceived.next({
          data: { type: 'message', message: messages[1] }
        })
        serializeThread.mockReturnValue(messages)
        vi.runAllTimers()
        expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
          game: { id: game.id, messages }
        })
        expect(runMutation).toHaveBeenCalledTimes(1)
        expect(serializeThread).toHaveBeenCalledTimes(1)
        expect(send).not.toHaveBeenCalled()
      })

      it('saves message thread upon send', () => {
        const messages = ['hej!', 'hallo!!']
        lastMessageSent.next({
          data: { type: 'message', message: messages[0] }
        })
        lastMessageSent.next({
          data: { type: 'message', message: messages[1] }
        })
        serializeThread.mockReturnValue(messages)
        vi.runAllTimers()
        expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
          game: { id: game.id, messages }
        })
        expect(runMutation).toHaveBeenCalledTimes(1)
        expect(serializeThread).toHaveBeenCalledTimes(1)
        expect(send).not.toHaveBeenCalled()
      })

      it('saves message ordered thread', async () => {
        const messages = ['hej!', 'hallo!!', 'salut!!!']
        lastMessageSent.next({
          data: { type: 'message', message: messages[0] }
        })
        lastMessageReceived.next({
          data: { type: 'message', message: messages[1] }
        })
        lastMessageSent.next({
          data: { type: 'message', message: messages[2] }
        })
        serializeThread.mockReturnValue(messages)
        vi.runAllTimers()
        expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
          game: { id: game.id, messages }
        })
        expect(runMutation).toHaveBeenCalledTimes(1)
        expect(serializeThread).toHaveBeenCalledTimes(1)
        expect(send).not.toHaveBeenCalled()
        await connectPeerAndExpectGameSync(
          {
            ...game,
            messages,
            hands: [...game.hands, { playerId: player.id, meshes: [] }]
          },
          partner1.id
        )
      })

      it('merges and saves its camera positions', async () => {
        const playerCameras = [{ pos: 'a' }, { pos: 'b' }]
        cameraSaves.next(playerCameras)
        const cameras = [
          game.cameras[1],
          { playerId: player.id, index: 0, ...playerCameras[0] },
          { playerId: player.id, index: 1, ...playerCameras[1] }
        ]
        expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
          game: { id: game.id, cameras }
        })
        expect(runMutation).toHaveBeenCalledTimes(1)
        await connectPeerAndExpectGameSync(
          {
            ...game,
            cameras,
            hands: [...game.hands, { playerId: player.id, meshes: [] }]
          },
          partner1.id
        )
      })

      it('merges and saves other cameras', () => {
        const cameras = [{ pos: 'a' }, { pos: 'b' }]
        lastMessageReceived.next({
          data: { type: 'saveCameras', cameras, playerId: partner1.id }
        })

        expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
          game: {
            id: game.id,
            cameras: [
              game.cameras[0],
              { playerId: partner1.id, index: 0, ...cameras[0] },
              { playerId: partner1.id, index: 1, ...cameras[1] }
            ]
          }
        })
        expect(runMutation).toHaveBeenCalledTimes(1)
        expect(send).not.toHaveBeenCalled()
      })

      it('creates and saves hand for current player', () => {
        const handMeshes = meshes.slice(0, 1)
        handMeshes$.next(handMeshes)
        const expectedGame = {
          id: game.id,
          hands: [...game.hands, { playerId: player.id, meshes: handMeshes }]
        }
        expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
          game: expectedGame
        })
        expect(runMutation).toHaveBeenCalledTimes(1)
        expect(engine.serialize).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
      })

      it('creates and saves hand for another player', () => {
        const handMeshes = meshes.slice(1)
        lastMessageReceived.next({
          data: {
            type: 'saveHand',
            meshes: handMeshes,
            playerId: partner1.id
          }
        })
        const expectedGame = {
          id: game.id,
          hands: [
            ...game.hands,
            { playerId: player.id, meshes: [] },
            { playerId: partner1.id, meshes: handMeshes }
          ]
        }
        expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
          game: expectedGame
        })
        expect(runMutation).toHaveBeenCalledTimes(1)
        expect(engine.serialize).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
      })
    })

    describe('with online players', () => {
      const meshes = [{ id: 'mesh1' }, { id: 'mesh2' }, { id: 'mesh3' }]
      const game = {
        id: faker.datatype.uuid(),
        meshes,
        players: [
          { playing: true, ...player },
          { playing: true, ...partner1 },
          partner2
        ],
        hands: [
          { playerId: 'anotherPlayerId', meshes: [{ id: 'mesh2' }] },
          { playerId: player.id, meshes: [{ id: 'mesh3' }] }
        ],
        cameras: [
          { playerId: player.id, index: 0, pos: '10' },
          { playerId: partner1.id, index: 0, pos: '1' },
          { playerId: partner2.id, index: 0, pos: '100' }
        ],
        messages: ['coucou', 'yeah']
      }

      beforeEach(() => {
        vi.useFakeTimers()
        prepareGame(game)
      })

      afterEach(() => vi.useRealTimers())

      it('fails when not receiving game from online players', async () => {
        error.mockImplementationOnce(() => {})
        const errorMessage = 'No game data after 30s'
        const promise = loadGame(game.id, { player, turnCredentials })
        await nextPromise()
        await nextPromise()
        vi.runAllTimers()
        await expect(promise).rejects.toThrow(errorMessage)
        expect(error).toHaveBeenCalledWith(errorMessage)
        expect(runQuery).toHaveBeenCalledWith(
          graphQL.loadGame,
          { gameId: game.id },
          false
        )
        expect(runQuery).toHaveBeenCalledTimes(1)
        expect(connectWith).toHaveBeenCalledWith(partner1.id, turnCredentials)
        expect(connectWith).toHaveBeenCalledTimes(1)
        expect(engine.load).not.toHaveBeenCalled()
        expect(loadCameraSaves).not.toHaveBeenCalled()
        expect(loadThread).not.toHaveBeenCalled()
        expect(runMutation).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
        expect(closeChannels).toHaveBeenCalledTimes(1)
      })

      describe('with loaded game for peers', () => {
        beforeEach(async () => {
          connectWith.mockImplementationOnce(async () => {
            await nextPromise()
            lastMessageReceived.next({
              data: { type: 'game-sync', ...game },
              playerId: partner1.id
            })
          })
          await loadGame(game.id, { player, turnCredentials })
        })

        it('loads game data from online players', async () => {
          expect(runQuery).toHaveBeenCalledWith(
            graphQL.loadGame,
            { gameId: game.id },
            false
          )
          expect(runQuery).toHaveBeenCalledTimes(1)
          expect(connectWith).toHaveBeenCalledWith(partner1.id, turnCredentials)
          expect(connectWith).toHaveBeenCalledTimes(1)
          expect(runMutation).not.toHaveBeenCalled()
          expect(send).not.toHaveBeenCalled()
          expect(engine.load).toHaveBeenCalledWith(
            { ...game, type: 'game-sync' },
            player.id,
            true
          )
          expect(engine.load).toHaveBeenCalledTimes(1)
          expect(loadCameraSaves).toHaveBeenCalledWith(game.cameras.slice(0, 1))
          expect(loadCameraSaves).toHaveBeenCalledTimes(1)
          expect(loadThread).toHaveBeenCalledWith(game.messages)
          expect(loadThread).toHaveBeenCalledTimes(1)
          expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
            new Map(
              game.players.map(gamer => [
                gamer.id,
                {
                  ...gamer,
                  isHost: gamer.id === partner1.id,
                  playing: gamer.id === player.id
                }
              ])
            )
          )
          expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(4)
          expect(runSubscription).not.toHaveBeenCalled()
        })

        it('share hand with other peers', async () => {
          vi.clearAllMocks()
          const handMeshes = meshes.slice(0, 1)
          handMeshes$.next(handMeshes)
          expect(engine.serialize).not.toHaveBeenCalled()
          expect(send).toHaveBeenCalledWith({
            meshes: handMeshes,
            playerId: player.id,
            type: 'saveHand'
          })
          expect(send).toHaveBeenCalledTimes(1)
          expect(loadCameraSaves).not.toHaveBeenCalled()
          expect(runMutation).not.toHaveBeenCalled()
        })

        it('share cameras with other peers', async () => {
          vi.clearAllMocks()
          const cameras = [{ pos: 'a' }, { pos: 'b' }]
          cameraSaves.next(cameras)
          expect(engine.serialize).not.toHaveBeenCalled()
          expect(send).toHaveBeenCalledWith({
            cameras,
            playerId: player.id,
            type: 'saveCameras'
          })
          expect(send).toHaveBeenCalledTimes(1)
          expect(loadCameraSaves).not.toHaveBeenCalled()
          expect(runMutation).not.toHaveBeenCalled()
        })
      })

      describe('with disconnecting host', () => {
        beforeEach(async () => {
          connectWith.mockImplementationOnce(async () => {
            await nextPromise()
            lastMessageReceived.next({
              data: { type: 'game-sync', ...game },
              playerId: partner1.id
            })
          })
          await loadGame(game.id, { player, turnCredentials })
          vi.clearAllMocks()
        })

        it('takes host role when being the first online', async () => {
          serializeThread.mockReturnValueOnce([])
          engine.serialize.mockReturnValueOnce({
            meshes: game.meshes,
            handMeshes: game.hands.find(
              ({ playerId }) => playerId === player.id
            ).meshes
          })
          lastDisconnectedId.next(partner1.id)
          await nextPromise()
          expect(send).toHaveBeenCalledWith(
            {
              type: 'game-sync',
              id: game.id,
              ...game,
              messages: []
            },
            undefined
          )
          expect(send).toHaveBeenCalledTimes(1)
          expect(closeChannels).not.toHaveBeenCalled()
          expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
            new Map([
              [player.id, { ...player, isHost: true, playing: true }],
              [partner1.id, { ...partner1, isHost: false, playing: false }],
              [partner2.id, { ...partner2, isHost: false, playing: false }]
            ])
          )
          expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(2)
          expect(runSubscription).toHaveBeenCalledWith(
            graphQL.receiveGameUpdates,
            { gameId: game.id }
          )
          expect(runSubscription).toHaveBeenCalledTimes(1)
          vi.clearAllMocks()
          const newcamera = { pos: 'a' }
          cameraSaves.next([newcamera])
          expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
            game: {
              id: game.id,
              cameras: [
                game.cameras[1],
                game.cameras[2],
                { playerId: player.id, index: 0, ...newcamera }
              ]
            }
          })
          expect(runMutation).toHaveBeenCalledTimes(1)
        })

        it('does not take host role when not being the first online', async () => {
          lastMessageReceived.next({
            data: {
              type: 'game-sync',
              ...game,
              players: [
                { playing: true, ...partner1 },
                { playing: true, ...partner2 },
                { playing: true, ...player }
              ]
            },
            playerId: partner1.id
          })
          lastConnectedId.next(partner2.id)
          lastDisconnectedId.next(partner1.id)
          await nextPromise()
          expect(send).not.toHaveBeenCalled()
          expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
            new Map([
              // this player will become host when they'll send their first update
              [player.id, { ...player, isHost: false, playing: true }],
              [partner1.id, { ...partner1, isHost: true, playing: false }],
              [partner2.id, { ...partner2, isHost: false, playing: true }]
            ])
          )
          expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(3)
          expect(runSubscription).not.toHaveBeenCalled()
        })
      })
    })
  })

  describe('invite()', () => {
    const game = {
      id: faker.datatype.uuid(),
      meshes: [],
      players: [],
      hands: []
    }
    const guest = { id: faker.datatype.uuid() }

    it('invites a given user to a game', async () => {
      runMutation.mockResolvedValueOnce(game)
      expect(await invite(game.id, guest.id)).toBe(true)
      expect(runMutation).toHaveBeenCalledWith(graphQL.invite, {
        gameId: game.id,
        playerId: guest.id
      })
      expect(runMutation).toHaveBeenCalledTimes(1)
      expect(engine.load).not.toHaveBeenCalled()
    })

    it('returns false when invite was declined', async () => {
      runMutation.mockResolvedValueOnce()
      expect(await invite(game.id, guest.id)).toBe(false)
      expect(runMutation).toHaveBeenCalledWith(graphQL.invite, {
        gameId: game.id,
        playerId: guest.id
      })
      expect(runMutation).toHaveBeenCalledTimes(1)
      expect(engine.load).not.toHaveBeenCalled()
    })
  })

  async function connectPeerAndExpectGameSync(
    { cameras, ...gameData },
    playerId
  ) {
    send.mockReset()
    lastConnectedId.next(playerId)
    await nextPromise()
    expect(send).toHaveBeenCalledWith(
      {
        type: 'game-sync',
        cameras: [...cameras].sort((a, b) => +a.index - +b.index),
        ...gameData
      },
      playerId
    )
    expect(send).toHaveBeenCalledTimes(1)
  }

  function prepareGame(game) {
    engine.onDisposeObservable.notifyObservers()
    runSubscription.mockImplementation(subscription =>
      subscription === graphQL.receiveGameUpdates ? gameUpdates$ : null
    )
    runQuery.mockResolvedValueOnce({
      ...game,
      meshes: [...game.meshes],
      hands: [...game.hands]
    })
  }

  // because of fake timers, we can't use sleep
  async function nextPromise() {
    for (let i = 0; i < 3; i++) {
      await Promise.resolve()
    }
  }
})

describe('createGame()', () => {
  it('creates a game', async () => {
    const kind = faker.lorem.word()
    const id = faker.datatype.uuid()
    runMutation.mockResolvedValueOnce({ id })
    expect(await createGame(kind)).toEqual(id)
    expect(runMutation).toHaveBeenCalledWith(graphQL.createGame, { kind })
    expect(runMutation).toHaveBeenCalledTimes(1)
  })
})

describe('deleteGame()', () => {
  it('deletes a game', async () => {
    const gameId = faker.datatype.uuid()
    expect(await deleteGame(gameId)).toBeUndefined()
    expect(runMutation).toHaveBeenCalledWith(graphQL.deleteGame, { gameId })
    expect(runMutation).toHaveBeenCalledTimes(1)
  })
})

describe('listGames()', () => {
  it('list all games', async () => {
    const games = [
      { id: faker.datatype.uuid(), created: faker.date.past().getTime() },
      { id: faker.datatype.uuid(), created: faker.date.past().getTime() },
      { id: faker.datatype.uuid(), created: faker.date.past().getTime() }
    ]
    runQuery.mockResolvedValueOnce(games)
    expect(await listGames()).toEqual(games)
    expect(runQuery).toHaveBeenCalledWith(graphQL.listGames)
    expect(runQuery).toHaveBeenCalledTimes(1)
  })
})

describe('receiveGameListUpdates()', () => {
  const games = [
    { id: faker.datatype.uuid(), created: faker.date.past().getTime() },
    { id: faker.datatype.uuid(), created: faker.date.past().getTime() },
    { id: faker.datatype.uuid(), created: faker.date.past().getTime() }
  ]

  it('initializes observable with provided list', () => {
    runSubscription.mockReturnValue(new Subject())
    const gameList$ = receiveGameListUpdates(games.slice(0, 1))
    expect(get(gameList$)).toEqual(games.slice(0, 1))
  })

  it('updates observable with received list', () => {
    const updatesReceived = vi.fn()
    const sendUpdate = new Subject()
    runSubscription.mockReturnValue(sendUpdate)
    const gameList$ = receiveGameListUpdates()
    gameList$.subscribe(updatesReceived)
    expect(updatesReceived).toHaveBeenCalledWith([])
    expect(updatesReceived).toHaveBeenCalledTimes(1)

    sendUpdate.next(games)
    expect(updatesReceived).toHaveBeenNthCalledWith(2, games)
    expect(updatesReceived).toHaveBeenCalledTimes(2)
  })
})
