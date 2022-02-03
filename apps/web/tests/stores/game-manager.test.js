import { Observable } from '@babylonjs/core/Misc/observable'
import * as faker from 'faker'
import { Subject } from 'rxjs'
import * as graphQL from '../../src/graphql'
import { action } from '../../src/stores/game-engine'
import { deleteGame, loadGame } from '../../src/stores/game-manager'
import {
  runQuery,
  runMutation,
  runSubscription
} from '../../src/stores/graphql-client'
import { send } from '../../src/stores/peer-channels'
import { currentPlayer } from '../../src/stores/players'
import { makeLogger } from '../../src/utils'

jest.mock('../../src/stores/graphql-client')
jest.mock('../../src/stores/game-engine', () => {
  const { BehaviorSubject, Subject } = require('rxjs')
  return {
    action: new Subject(),
    cameraSaves: new Subject(),
    engine: new BehaviorSubject(),
    loadCameraSaves: new BehaviorSubject()
  }
})
jest.mock('../../src/stores/peer-channels', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    closeChannels: jest.fn(),
    connectWith: jest.fn(),
    lastConnectedId: new BehaviorSubject(),
    lastDisconnectedId: new BehaviorSubject(),
    lastMessageReceived: new BehaviorSubject({}),
    lastMessageSent: new BehaviorSubject({}),
    send: jest.fn(),
    openChannels: jest.fn()
  }
})
jest.mock('../../src/stores/players', () => {
  const { BehaviorSubject } = require('rxjs')
  return { currentPlayer: new BehaviorSubject() }
})
jest.mock('../../src/3d/utils')

const logger = makeLogger('game-manager')

let warn

beforeEach(() => {
  jest.resetAllMocks()
  warn = jest.spyOn(logger, 'warn')
})

describe('given a mocked game engine', () => {
  const engine = {
    scenes: [],
    load: jest.fn(),
    serialize: jest.fn().mockReturnValue({}),
    onDisposeObservable: new Observable()
  }

  afterEach(() => {
    engine.onDisposeObservable.notifyObservers()
    engine.onDisposeObservable.clear()
  })

  describe('loadGame()', () => {
    it('does not load anything without current player', async () => {
      warn.mockImplementationOnce(() => {})
      await loadGame(faker.datatype.uuid(), engine)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(runQuery).not.toHaveBeenCalled()
      expect(engine.load).not.toHaveBeenCalled()
    })

    describe('given current player', () => {
      const player = { id: faker.datatype.uuid() }

      beforeAll(() => currentPlayer.next(player))

      beforeEach(() => runSubscription.mockReturnValue(new Subject()))

      it('loads game data into the game engine', async () => {
        const gameId = faker.datatype.uuid()
        const meshes = [{ id: 'mesh1' }]
        const hands = [
          { playerId: 'anotherPlayerId', meshes: [{ id: 'mesh2' }] },
          { playerId: player.id, meshes: [{ id: 'mesh3' }] }
        ]
        const game = { id: gameId, meshes, players: [], hands }
        runQuery.mockResolvedValueOnce(game)
        await loadGame(gameId, engine)
        expect(runQuery).toHaveBeenCalledWith(
          graphQL.loadGame,
          { gameId },
          false
        )
        expect(runQuery).toHaveBeenCalledTimes(1)
        expect(engine.load).toHaveBeenCalledWith(
          { meshes, handMeshes: hands[1].meshes },
          true
        )
        expect(engine.load).toHaveBeenCalledTimes(1)
      })

      it('loads game data without player hand', async () => {
        const gameId = faker.datatype.uuid()
        const meshes = [{ id: 'mesh2' }]
        const game = { id: gameId, meshes, players: [], hands: [] }
        runQuery.mockResolvedValueOnce(game)
        await loadGame(gameId, engine)
        expect(runQuery).toHaveBeenCalledWith(
          graphQL.loadGame,
          { gameId },
          false
        )
        expect(runQuery).toHaveBeenCalledTimes(1)
        expect(engine.load).toHaveBeenCalledWith(
          { meshes, handMeshes: [] },
          true
        )
        expect(engine.load).toHaveBeenCalledTimes(1)
      })

      describe('given a loaded game', () => {
        const meshes = [{ id: 'mesh1' }, { id: 'mesh2' }, { id: 'mesh3' }]
        const game = {
          id: faker.datatype.uuid(),
          meshes,
          players: [],
          hands: []
        }

        async function prepareGame(game) {
          engine.onDisposeObservable.notifyObservers()
          runSubscription.mockReturnValue(new Subject())
          runQuery.mockResolvedValueOnce({
            ...game,
            meshes: [...game.meshes],
            hands: [...game.hands]
          })
          await loadGame(game.id, engine)
          jest.resetAllMocks()
        }

        beforeEach(async () => {
          jest.useFakeTimers()
          await prepareGame(game)
        })

        afterEach(jest.useRealTimers)

        it('saves game data after some actions', () => {
          const mainMeshes = meshes.slice(1)
          const handMeshes = meshes.slice(0, 1)
          engine.serialize.mockReturnValueOnce({
            meshes: mainMeshes,
            handMeshes
          })
          action.next({ data: {} })
          action.next({ data: {} })
          jest.runAllTimers()
          const expectedGame = {
            id: game.id,
            meshes: mainMeshes,
            hands: [{ playerId: player.id, meshes: handMeshes }]
          }
          expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
            game: expectedGame
          })
          expect(runMutation).toHaveBeenCalledTimes(1)
          expect(engine.serialize).toHaveBeenCalledTimes(1)
          expect(send).toHaveBeenCalledWith({
            type: 'game-sync',
            ...expectedGame
          })
          expect(send).toHaveBeenCalledTimes(1)
        })
      })
    })
  })
})

describe('deleteGame', () => {
  it('deletes a game', async () => {
    const gameId = faker.datatype.uuid()
    expect(await deleteGame(gameId)).toBeUndefined()
    expect(runMutation).toHaveBeenCalledWith(graphQL.deleteGame, { gameId })
    expect(runMutation).toHaveBeenCalledTimes(1)
  })
})
