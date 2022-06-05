import { Observable } from '@babylonjs/core/Misc/observable'
import { faker } from '@faker-js/faker'
import { Subject } from 'rxjs'
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
  loadGame
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
import { currentPlayer } from '../../src/stores/players'
import { makeLogger } from '../../src/utils'

jest.mock('../../src/stores/graphql-client')
jest.mock('../../src/stores/game-engine', () => {
  const { BehaviorSubject, Subject } = require('rxjs')
  return {
    action: new Subject(),
    cameraSaves: new Subject(),
    handMeshes: new Subject(),
    engine: new BehaviorSubject(),
    loadCameraSaves: jest.fn()
  }
})
jest.mock('../../src/stores/peer-channels', () => {
  const { Subject } = require('rxjs')
  return {
    closeChannels: jest.fn(),
    connectWith: jest.fn(),
    lastConnectedId: new Subject(),
    lastDisconnectedId: new Subject(),
    lastMessageReceived: new Subject({}),
    lastMessageSent: new Subject({}),
    send: jest.fn(),
    openChannels: jest.fn()
  }
})
jest.mock('../../src/stores/players', () => {
  const { BehaviorSubject } = require('rxjs')
  return { currentPlayer: new BehaviorSubject() }
})
jest.mock('../../src/stores/discussion')
jest.mock('../../src/3d/utils')

const logger = makeLogger('game-manager')
const gamePlayerByIdReceived = jest.fn()
let subscription
let warn
let error

beforeAll(
  () => (subscription = gamePlayerById.subscribe(gamePlayerByIdReceived))
)

beforeEach(() => {
  jest.resetAllMocks()
  loadCameraSaves.mockImplementation(data => cameraSaves.next(data))
  warn = jest.spyOn(logger, 'warn')
  error = jest.spyOn(logger, 'error')
})

afterAll(() => subscription.unsubscribe())

describe('given a mocked game engine', () => {
  const engine = {
    scenes: [],
    load: jest.fn().mockResolvedValueOnce(),
    serialize: jest.fn().mockReturnValue({}),
    onDisposeObservable: new Observable()
  }

  beforeAll(() => engine$.next(engine))

  afterEach(() => {
    engine.onDisposeObservable.notifyObservers()
    engine.onDisposeObservable.clear()
  })

  describe('loadGame()', () => {
    it('does not load anything without current player', async () => {
      warn.mockImplementationOnce(() => {})
      await loadGame(faker.datatype.uuid())
      expect(warn).toHaveBeenCalledTimes(1)
      expect(runQuery).not.toHaveBeenCalled()
      expect(engine.load).not.toHaveBeenCalled()
      expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(0)
    })

    describe('with current player', () => {
      const player = { id: faker.datatype.uuid() }
      const partner1 = { id: faker.datatype.uuid() }
      const partner2 = { id: faker.datatype.uuid() }

      beforeEach(() => {
        currentPlayer.next(player)
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
        runQuery.mockResolvedValueOnce(game)
        await loadGame(gameId)
        expect(runQuery).toHaveBeenCalledWith(
          graphQL.loadGame,
          { gameId },
          false
        )
        expect(runQuery).toHaveBeenCalledTimes(1)
        expect(engine.load).toHaveBeenCalledWith(game, player.id, true)
        expect(engine.load).toHaveBeenCalledTimes(1)
        expect(loadCameraSaves).not.toHaveBeenCalled()
        expect(loadThread).not.toHaveBeenCalled()
        expect(connectWith).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
        expect(openChannels).toHaveBeenCalledWith(player, gameId)
        expect(gamePlayerByIdReceived).toHaveBeenNthCalledWith(
          1,
          new Map([[player.id, { ...player, isHost: false }]])
        )
        expect(gamePlayerByIdReceived).toHaveBeenNthCalledWith(
          2,
          new Map([[player.id, { ...player, isHost: true }]])
        )
        expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(2)
      })

      it('loads camera positions upon game loading', async () => {
        const gameId = faker.datatype.uuid()
        const meshes = [{ id: 'mesh1' }]
        const hands = []
        const cameras = [
          { playerId: player.id, index: 1, pos: '10' },
          { playerId: partner1.id, index: 0, pos: '1' },
          { playerId: player.id, index: 0, pos: '20' }
        ]
        const game = { id: gameId, meshes, players: [], hands, cameras }
        engine.serialize.mockReturnValueOnce({ meshes, handMeshes: [] })
        serializeThread.mockReturnValueOnce([])
        runQuery.mockResolvedValueOnce(game)
        await loadGame(gameId)
        expect(runQuery).toHaveBeenCalledWith(
          graphQL.loadGame,
          { gameId },
          false
        )
        expect(runQuery).toHaveBeenCalledTimes(1)
        expect(engine.load).toHaveBeenCalledWith(game, player.id, true)
        expect(engine.load).toHaveBeenCalledTimes(1)
        expect(loadCameraSaves).toHaveBeenCalledWith([cameras[2], cameras[0]])
        expect(loadCameraSaves).toHaveBeenCalledTimes(1)
        expect(send).not.toHaveBeenCalled()
      })

      it('loads message thread upon game loading', async () => {
        const gameId = faker.datatype.uuid()
        const meshes = [{ id: 'mesh1' }]
        const hands = []
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
        await loadGame(gameId)
        expect(runQuery).toHaveBeenCalledWith(
          graphQL.loadGame,
          { gameId },
          false
        )
        expect(runQuery).toHaveBeenCalledTimes(1)
        expect(engine.load).toHaveBeenCalledWith(game, player.id, true)
        expect(engine.load).toHaveBeenCalledTimes(1)
        expect(loadCameraSaves).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
      })

      it('loads game data without player hand', async () => {
        const gameId = faker.datatype.uuid()
        const meshes = [{ id: 'mesh2' }]
        const game = { id: gameId, meshes, players: [], hands: [] }
        runQuery.mockResolvedValueOnce(game)
        await loadGame(gameId)
        expect(runQuery).toHaveBeenCalledWith(
          graphQL.loadGame,
          { gameId },
          false
        )
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
            { playerId: player.id, index: 0, pos: '10' },
            { playerId: partner1.id, index: 0, pos: '1' }
          ],
          messages: [],
          zoomSpec: { min: 4, initial: 15 },
          tableSpec: { width: 75, height: 50 }
        }

        beforeEach(async () => {
          jest.useFakeTimers()
          prepareGame(game)
          await loadGame(game.id)
          jest.resetAllMocks()
          engine.serialize.mockReturnValue({ meshes, handMeshes: [] })
          serializeThread.mockReturnValue(game.messages)
        })

        afterEach(jest.useRealTimers)

        it('sends game data to joining player', () => {
          expectsFullGame({
            ...game,
            hands: [...game.hands, { playerId: player.id, meshes: [] }]
          })
          expect(engine.serialize).toHaveBeenCalledTimes(1)
          expect(serializeThread).toHaveBeenCalledTimes(1)
        })

        it('saves game data after some actions', () => {
          action.next({ data: {} })
          action.next({ data: {} })
          jest.runAllTimers()
          const expectedGame = {
            ...game,
            cameras: [...game.cameras].sort((a, b) => +a.pos - +b.pos),
            hands: [...game.hands, { playerId: player.id, meshes: [] }],
            zoomSpec: undefined,
            tableSpec: undefined,
            players: undefined
          }
          expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
            game: expectedGame
          })
          expect(runMutation).toHaveBeenCalledTimes(1)
          expect(engine.serialize).toHaveBeenCalledTimes(1)
          expect(send).toHaveBeenCalledWith(
            { type: 'game-sync', ...expectedGame },
            undefined
          )
          expect(send).toHaveBeenCalledTimes(1)
          expectsFullGame(expectedGame)
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
          jest.runAllTimers()
          const expectedGame = { id: game.id, messages }
          expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
            game: expectedGame
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
          jest.runAllTimers()
          const expectedGame = { id: game.id, messages }
          expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
            game: expectedGame
          })
          expect(runMutation).toHaveBeenCalledTimes(1)
          expect(serializeThread).toHaveBeenCalledTimes(1)
          expect(send).not.toHaveBeenCalled()
        })

        it('saves message ordered thread', () => {
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
          jest.runAllTimers()
          const expectedGame = { id: game.id, messages }
          expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
            game: expectedGame
          })
          expect(runMutation).toHaveBeenCalledTimes(1)
          expect(serializeThread).toHaveBeenCalledTimes(1)
          expect(send).not.toHaveBeenCalled()
          expectsFullGame({
            ...game,
            messages,
            hands: [...game.hands, { playerId: player.id, meshes: [] }]
          })
        })

        it('merges and saves its camera positions', () => {
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
          expectsFullGame({
            ...game,
            cameras,
            hands: [...game.hands, { playerId: player.id, meshes: [] }]
          })
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
          players: [player, { playing: true, ...partner1 }, partner2],
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
          jest.useFakeTimers()
          prepareGame(game)
        })

        afterEach(jest.useRealTimers)

        it('fails when not receiving game from online players', async () => {
          error.mockImplementationOnce(() => {})
          const errorMessage = 'No game data after 30s'
          const promise = loadGame(game.id)
          await nextPromise()
          jest.runAllTimers()
          await expect(promise).rejects.toThrow(errorMessage)
          expect(error).toHaveBeenCalledWith(errorMessage)
          expect(runQuery).toHaveBeenCalledWith(
            graphQL.loadGame,
            { gameId: game.id },
            false
          )
          expect(runQuery).toHaveBeenCalledTimes(1)
          expect(connectWith).toHaveBeenCalledWith(partner1.id)
          expect(connectWith).toHaveBeenCalledTimes(1)
          expect(engine.load).not.toHaveBeenCalled()
          expect(loadCameraSaves).not.toHaveBeenCalled()
          expect(loadThread).not.toHaveBeenCalled()
          expect(runMutation).not.toHaveBeenCalled()
          expect(send).not.toHaveBeenCalled()
          expect(closeChannels).toHaveBeenCalledTimes(1)
        })

        it('loads game data from online players', async () => {
          connectWith.mockImplementationOnce(async () => {
            await nextPromise()
            lastMessageReceived.next({
              data: { type: 'game-sync', ...game },
              playerId: partner1.id
            })
          })
          await loadGame(game.id)
          expect(runQuery).toHaveBeenCalledWith(
            graphQL.loadGame,
            { gameId: game.id },
            false
          )
          expect(runQuery).toHaveBeenCalledTimes(1)
          expect(connectWith).toHaveBeenCalledWith(partner1.id)
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
          expect(gamePlayerByIdReceived).toHaveBeenNthCalledWith(
            1,
            new Map(
              game.players.map(player => [
                player.id,
                { ...player, isHost: false }
              ])
            )
          )
          expect(gamePlayerByIdReceived).toHaveBeenNthCalledWith(
            2,
            new Map(
              game.players.map(player => [
                player.id,
                { ...player, isHost: player.id === partner1.id }
              ])
            )
          )
          expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(2)
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
            await loadGame(game.id)
            jest.resetAllMocks()
          })

          it('takes host role when being the first online', async () => {
            serializeThread.mockReturnValueOnce([])
            engine.serialize.mockReturnValueOnce({
              meshes: game.meshes,
              handMeshes: game.hands.find(
                ({ playerId }) => playerId === player.id
              ).meshes
            })
            runQuery.mockResolvedValue({
              players: [
                { playing: true, ...player },
                { playing: true, ...partner1 }
              ]
            })
            lastDisconnectedId.next(partner1.id)
            await nextPromise()
            expect(runQuery).toHaveBeenCalledWith(graphQL.loadGamePlayers, {
              gameId: game.id
            })
            expect(runQuery).toHaveBeenCalledTimes(1)
            lastConnectedId.next(partner2.id)
            expect(send).toHaveBeenCalledWith(
              {
                type: 'game-sync',
                id: game.id,
                cameras: game.cameras,
                meshes: game.meshes,
                messages: [],
                hands: game.hands
              },
              partner2.id
            )
            expect(send).toHaveBeenCalledTimes(1)
            expect(closeChannels).not.toHaveBeenCalled()
            expect(gamePlayerByIdReceived).toHaveBeenNthCalledWith(
              1,
              new Map([
                [player.id, { ...player, isHost: true }],
                // playing status will be updated with game list subscription
                [partner1.id, { ...partner1, isHost: false, playing: true }],
                [partner2.id, { ...partner2, isHost: false }]
              ])
            )
            expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(1)
          })

          it('does not take host role when not being the first online', async () => {
            runQuery.mockResolvedValue({
              players: [
                { playing: true, ...partner1 },
                { playing: true, ...player }
              ]
            })
            lastDisconnectedId.next(partner1.id)
            await nextPromise()
            expect(runQuery).toHaveBeenCalledWith(graphQL.loadGamePlayers, {
              gameId: game.id
            })
            expect(runQuery).toHaveBeenCalledTimes(1)
            lastConnectedId.next(partner2.id)
            expect(send).not.toHaveBeenCalled()
            expect(gamePlayerByIdReceived).not.toHaveBeenCalled()
          })
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
    const player = { id: faker.datatype.uuid() }
    const guest = { id: faker.datatype.uuid() }

    beforeAll(() => currentPlayer.next(player))

    it('invites a given user to a game', async () => {
      runMutation.mockResolvedValueOnce(game)
      expect(await invite(game.id, guest.id)).toBe(true)
      expect(runMutation).toHaveBeenCalledWith(graphQL.invite, {
        gameId: game.id,
        playerId: guest.id
      })
      expect(runMutation).toHaveBeenCalledTimes(1)
      expect(engine.load).toHaveBeenCalledWith(game, player.id, false)
      expect(engine.load).toHaveBeenCalledTimes(1)
    })

    it('returns false when invite was declined', async () => {
      runMutation.mockResolvedValueOnce()
      expect(await invite(game.id, guest.id)).toBe(false)
      expect(runMutation).toHaveBeenCalledWith(graphQL.invite, {
        gameId: game.id,
        playerId: guest.id
      })
      expect(runMutation).toHaveBeenCalledTimes(1)
    })
  })

  function expectsFullGame({ id, cameras, messages, hands, meshes }) {
    const playerId = faker.datatype.uuid()
    send.mockReset()
    lastConnectedId.next(playerId)
    expect(send).toHaveBeenCalledWith(
      {
        type: 'game-sync',
        id,
        cameras: [...cameras].sort((a, b) => +a.pos - +b.pos),
        meshes,
        messages,
        hands
      },
      playerId
    )
    expect(send).toHaveBeenCalledTimes(1)
  }

  function prepareGame(game) {
    engine.onDisposeObservable.notifyObservers()
    runSubscription.mockReturnValue(new Subject())
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
