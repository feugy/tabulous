import { Observable } from '@babylonjs/core/Misc/observable'
import { faker } from '@faker-js/faker'
import * as graphQL from '@src/graphql'
import { loadThread, serializeThread } from '@src/stores/discussion'
import {
  action,
  cameraSaves,
  engine as engine$,
  handMeshes as handMeshes$,
  loadCameraSaves,
  remoteSelection,
  selectedMeshes
} from '@src/stores/game-engine'
import {
  createGame,
  deleteGame,
  gamePlayerById,
  invite,
  joinGame,
  leaveGame,
  listGames,
  playerColor,
  promoteGame,
  receiveGameListUpdates
} from '@src/stores/game-manager'
import {
  runMutation,
  runQuery,
  runSubscription
} from '@src/stores/graphql-client'
import { notify } from '@src/stores/notifications'
import {
  closeChannels,
  connectWith,
  lastConnectedId,
  lastDisconnectedId,
  lastMessageReceived,
  lastMessageSent,
  openChannels,
  send
} from '@src/stores/peer-channels'
import { lastToast } from '@src/stores/toaster'
import {
  buildPlayerColors,
  findPlayerColor,
  findPlayerPreferences,
  makeLogger
} from '@src/utils'
import { translate } from '@tests/test-utils'
import { Subject } from 'rxjs'
import { get } from 'svelte/store'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

vi.mock('@src/stores/discussion')
vi.mock('@src/stores/graphql-client')
vi.mock('@src/stores/game-engine', () => {
  const { BehaviorSubject, Subject } = require('rxjs')
  return {
    action: new Subject(),
    cameraSaves: new Subject(),
    handMeshes: new Subject(),
    engine: new BehaviorSubject(),
    loadCameraSaves: vi.fn(),
    selectedMeshes: new BehaviorSubject([]),
    remoteSelection: new Subject()
  }
})
vi.mock('@src/stores/notifications')
vi.mock('@src/stores/peer-channels', () => {
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
vi.mock('@src/3d/utils')

const logger = makeLogger('game-manager')
const gamePlayerByIdReceived = vi.fn()
const playerColorReceived = vi.fn()
const toastReceived = vi.fn()
const promotionReceived = vi.fn()
const deletionReceived = vi.fn()
const turnCredentials = { turn: 'credentials' }
const engine = {
  scenes: [],
  load: vi.fn().mockResolvedValue(),
  serialize: vi.fn().mockReturnValue({}),
  onDisposeObservable: new Observable(),
  onBeforeDisposeObservable: new Observable()
}
const gameUpdates$ = new Subject()
let subscriptions
let error

const player = {
  id: 'player',
  username: 'player',
  isGuest: false
}
const partner1 = {
  id: 'partner1',
  username: 'partner 1'
}
const partner2 = {
  id: 'partner2',
  username: 'partner 2',
  isGuest: false
}
const partner3 = {
  id: 'partner3',
  username: 'partner 3'
}

beforeAll(() => {
  subscriptions = [
    gamePlayerById.subscribe(gamePlayerByIdReceived),
    playerColor.subscribe(playerColorReceived),
    lastToast.subscribe(toastReceived)
  ]
})

beforeEach(() => {
  vi.resetAllMocks()
  error = vi.spyOn(logger, 'error')
})

afterAll(() =>
  subscriptions.forEach(subscription => subscription.unsubscribe())
)

describe('given no engine', async () => {
  describe('joinGame()', () => {
    const game = {
      id: faker.datatype.uuid(),
      kind: 'belote',
      meshes: [{ id: 'mesh1' }],
      players: [player],
      hands: [{ playerId: player.id, meshes: [] }]
    }
    const lobby = {
      id: faker.datatype.uuid(),
      meshes: [],
      players: [player, partner1, partner2, partner3],
      messages: ['coucou', 'yeah'],
      hands: []
    }

    beforeEach(() => {
      loadCameraSaves.mockImplementation(data => cameraSaves.next(data))
      runSubscription.mockReturnValueOnce(new Subject())
    })

    afterEach(() => leaveGame(player))

    it('loads game data', async () => {
      runMutation.mockResolvedValueOnce(game)
      await joinGame({ gameId: game.id, player, turnCredentials })
      expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
        gameId: game.id,
        parameters: undefined
      })
      expect(runMutation).toHaveBeenCalledOnce()
      expect(runSubscription).toHaveBeenCalledWith(graphQL.receiveGameUpdates, {
        gameId: game.id
      })
      expect(runSubscription).toHaveBeenCalledOnce()
      expect(loadCameraSaves).not.toHaveBeenCalled()
      expect(loadThread).not.toHaveBeenCalled()
      expect(connectWith).not.toHaveBeenCalled()
      expect(send).toHaveBeenCalledWith(
        {
          type: 'game-sync',
          ...game,
          meshes: undefined,
          cameras: [],
          selections: []
        },
        undefined
      )
      expect(send).toHaveBeenCalledOnce()
      expect(openChannels).toHaveBeenCalledWith(
        player,
        turnCredentials,
        game.id
      )
      expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
        new Map([[player.id, { ...player, isHost: true, playing: true }]])
      )
      expect(playerColorReceived).toHaveBeenLastCalledWith(
        findPlayerColor(game, player.id)
      )
      expect(toastReceived).not.toHaveBeenCalled()
    })

    it('loads lobby data', async () => {
      runMutation.mockResolvedValueOnce(lobby)
      await joinGame({ gameId: lobby.id, player, turnCredentials })
      expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
        gameId: lobby.id,
        parameters: undefined
      })
      expect(runMutation).toHaveBeenCalledOnce()
      expect(runSubscription).toHaveBeenCalledWith(graphQL.receiveGameUpdates, {
        gameId: lobby.id
      })
      expect(runSubscription).toHaveBeenCalledOnce()
      expect(loadCameraSaves).not.toHaveBeenCalled()
      expect(loadThread).toHaveBeenCalledWith(lobby.messages)
      expect(loadThread).toHaveBeenCalledOnce()
      expect(connectWith).not.toHaveBeenCalled()
      expect(send).not.toHaveBeenCalled()
      expect(openChannels).toHaveBeenCalledWith(
        player,
        turnCredentials,
        lobby.id
      )
      expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
        new Map([
          [player.id, { ...player, isHost: true, playing: true }],
          [partner1.id, { ...partner1, isHost: false, playing: false }],
          [partner2.id, { ...partner2, isHost: false, playing: false }],
          [partner3.id, { ...partner3, isHost: false, playing: false }]
        ])
      )
      expect(playerColorReceived).toHaveBeenLastCalledWith(
        findPlayerColor(game, player.id)
      )
      expect(toastReceived).not.toHaveBeenCalled()
    })

    describe('with a loaded lobby', () => {
      beforeEach(async () => {
        prepareGame(lobby)
        await joinGame({
          gameId: lobby.id,
          player,
          turnCredentials,
          onPromotion: promotionReceived,
          onDeletion: deletionReceived
        })
        lastConnectedId.next(partner1.id)
        await nextPromise()
        vi.clearAllMocks()
        serializeThread.mockReturnValue(lobby.messages)
      })

      it('keeps peer channels when joining the same lobby', async () => {
        await joinGame({
          gameId: lobby.id,
          player,
          turnCredentials,
          onPromotion: promotionReceived,
          onDeletion: deletionReceived
        })
        expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
          gameId: lobby.id,
          parameters: undefined
        })
        expect(runMutation).toHaveBeenCalledOnce()
        expect(runSubscription).toHaveBeenCalledWith(
          graphQL.receiveGameUpdates,
          {
            gameId: lobby.id
          }
        )
        expect(runSubscription).toHaveBeenCalledOnce()
        expect(loadCameraSaves).not.toHaveBeenCalled()
        expect(loadThread).toHaveBeenCalledWith(lobby.messages)
        expect(loadThread).toHaveBeenCalledOnce()
        expect(connectWith).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
        expect(openChannels).not.toHaveBeenCalled()
        expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
          new Map([
            [player.id, { ...player, isHost: true, playing: true }],
            [partner1.id, { ...partner1, isHost: false, playing: true }],
            [partner2.id, { ...partner2, isHost: false, playing: false }],
            [partner3.id, { ...partner3, isHost: false, playing: false }]
          ])
        )
        expect(playerColorReceived).toHaveBeenLastCalledWith(
          findPlayerColor(game, player.id)
        )
        expect(toastReceived).not.toHaveBeenCalled()
      })

      it('notifies about joining player', async () => {
        lastConnectedId.next(partner2.id)
        await nextPromise()
        expect(serializeThread).toHaveBeenCalledOnce()
        expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
          new Map([
            [player.id, { ...player, isHost: true, playing: true }],
            [partner1.id, { ...partner1, isHost: false, playing: true }],
            [partner2.id, { ...partner2, isHost: false, playing: true }],
            [partner3.id, { ...partner3, isHost: false, playing: false }]
          ])
        )
        expect(toastReceived).toHaveBeenCalledWith({
          content: translate('labels.player-joined-lobby', {
            player: partner2
          }),
          icon: 'person_add_alt_1'
        })
        expect(toastReceived).toHaveBeenCalledOnce()
      })

      it('notifies about leaving player', async () => {
        lastDisconnectedId.next(partner1.id)
        await nextPromise()
        expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
          new Map([
            [player.id, { ...player, isHost: true, playing: true }],
            [partner1.id, { ...partner1, isHost: false, playing: false }],
            [partner2.id, { ...partner2, isHost: false, playing: false }],
            [partner3.id, { ...partner3, isHost: false, playing: false }]
          ])
        )
        expect(toastReceived).toHaveBeenCalledWith({
          content: translate('labels.player-left-lobby', {
            player: partner1
          }),
          icon: 'person_remove'
        })
        expect(toastReceived).toHaveBeenCalledOnce()
      })

      it('notifies of lobby promotion from server', async () => {
        const promotedLobby = {
          ...lobby,
          meshes: game.meshes,
          kind: 'belote',
          players: lobby.players.map(player => ({ ...player, isGuest: true }))
        }
        gameUpdates$.next(promotedLobby)
        await nextPromise()
        expect(promotionReceived).toHaveBeenCalledWith(promotedLobby)
        expect(promotionReceived).toHaveBeenCalledOnce()
        expect(deletionReceived).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
        expect(playerColorReceived).toHaveLastReturnedWith()
        expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
          new Map([
            [
              player.id,
              { ...player, isHost: true, isGuest: true, playing: true }
            ],
            [
              partner1.id,
              { ...partner1, isHost: false, isGuest: true, playing: true }
            ],
            [
              partner2.id,
              { ...partner2, isHost: false, isGuest: true, playing: false }
            ],
            [
              partner3.id,
              { ...partner3, isHost: false, isGuest: true, playing: false }
            ]
          ])
        )
      })

      it('notifies of lobby deletion from server', async () => {
        gameUpdates$.next(null)
        await nextPromise()
        expect(deletionReceived).toHaveBeenCalledOnce()
        expect(promotionReceived).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
        expect(playerColorReceived).toHaveLastReturnedWith()
        expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(new Map())
      })
    })
  })
})

describe('given a mocked game engine', () => {
  beforeAll(() => engine$.next(engine))

  beforeEach(() => {
    loadCameraSaves.mockImplementation(data => cameraSaves.next(data))
    runSubscription.mockReturnValueOnce(new Subject())
  })

  afterEach(() => {
    engine.onDisposeObservable.notifyObservers()
    engine.onDisposeObservable.clear()
    engine.onBeforeDisposeObservable.clear()
  })

  describe('joinGame()', () => {
    afterEach(() => leaveGame(player))

    it('loads game data into the game engine', async () => {
      const gameId = faker.datatype.uuid()
      const meshes = [{ id: 'mesh1' }]
      const hands = [
        { playerId: 'anotherPlayerId', meshes: [{ id: 'mesh2' }] },
        { playerId: player.id, meshes: [{ id: 'mesh3' }] }
      ]
      const color = '#00ff00'
      const preferences = [
        { playerId: 'anotherPlayerId', color: '#ffffff' },
        { playerId: player.id, color }
      ]
      const game = {
        id: gameId,
        kind: 'belote',
        meshes,
        players: [player],
        hands,
        preferences
      }
      const colorByPlayerId = buildPlayerColors(game)
      engine.serialize.mockReturnValue({
        meshes,
        handMeshes: hands[1].meshes
      })
      runMutation.mockResolvedValueOnce(game)
      await joinGame({ gameId, player, turnCredentials })
      expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
        gameId,
        parameters: undefined
      })
      expect(runMutation).toHaveBeenCalledOnce()
      expect(runSubscription).toHaveBeenCalledWith(graphQL.receiveGameUpdates, {
        gameId
      })
      expect(runSubscription).toHaveBeenCalledOnce()
      expect(engine.load).toHaveBeenCalledWith(
        game,
        player.id,
        colorByPlayerId,
        true
      )
      expect(engine.load).toHaveBeenCalledOnce()
      expect(loadCameraSaves).not.toHaveBeenCalled()
      expect(loadThread).not.toHaveBeenCalled()
      expect(connectWith).not.toHaveBeenCalled()
      expect(send).toHaveBeenCalledWith(
        { type: 'game-sync', ...game, cameras: [], selections: [] },
        undefined
      )
      expect(send).toHaveBeenCalledOnce()
      expect(openChannels).toHaveBeenCalledWith(player, turnCredentials, gameId)
      expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
        new Map([
          [player.id, { ...player, isHost: true, playing: true, color }]
        ])
      )
      expect(playerColorReceived).toHaveBeenLastCalledWith(
        findPlayerColor(game, player.id)
      )
      expect(toastReceived).not.toHaveBeenCalled()
    })

    it('does not load data when receiving game parameters', async () => {
      const gameId = faker.datatype.uuid()
      const game = {
        id: gameId,
        players: [player],
        schemaString: '{}'
      }
      runMutation.mockResolvedValueOnce(game)
      expect(await joinGame({ gameId, player, turnCredentials })).toEqual(game)
      expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
        gameId,
        parameters: undefined
      })
      expect(runMutation).toHaveBeenCalledOnce()
      expect(runSubscription).toHaveBeenCalledWith(graphQL.receiveGameUpdates, {
        gameId
      })
      expect(runSubscription).toHaveBeenCalledOnce()
      expect(engine.load).not.toHaveBeenCalled()
      expect(loadCameraSaves).not.toHaveBeenCalled()
      expect(loadThread).not.toHaveBeenCalled()
      expect(connectWith).not.toHaveBeenCalled()
      expect(send).not.toHaveBeenCalled()
      expect(openChannels).toHaveBeenCalledWith(player, turnCredentials, gameId)
      expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
        new Map([[player.id, { ...player, isHost: true, playing: true }]])
      )
      expect(playerColorReceived).toHaveBeenLastCalledWith(
        findPlayerColor(game, player.id)
      )
      expect(toastReceived).not.toHaveBeenCalled()
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
      const game = {
        id: gameId,
        kind: 'belote',
        meshes,
        players: [player],
        hands,
        cameras
      }
      engine.serialize.mockReturnValueOnce({ meshes, handMeshes: [] })
      serializeThread.mockReturnValueOnce([])
      runMutation.mockResolvedValueOnce(game)
      await joinGame({ gameId, player, turnCredentials })
      expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
        gameId,
        parameters: undefined
      })
      expect(runMutation).toHaveBeenCalledOnce()
      expect(engine.load).toHaveBeenCalledWith(
        game,
        player.id,
        buildPlayerColors(game),
        true
      )
      expect(engine.serialize).toHaveBeenCalledOnce()
      expect(engine.load).toHaveBeenCalledOnce()
      expect(loadCameraSaves).toHaveBeenCalledWith([cameras[2], cameras[0]])
      expect(loadCameraSaves).toHaveBeenCalledOnce()
      expect(send).toHaveBeenCalledWith(
        {
          type: 'game-sync',
          ...game,
          messages: [],
          cameras,
          selections: []
        },
        undefined
      )
      expect(send).toHaveBeenCalledOnce()
    })

    it('loads message thread upon game loading', async () => {
      const gameId = faker.datatype.uuid()
      const meshes = [{ id: 'mesh1' }]
      const hands = [{ playerId: player.id, meshes: [] }]
      const messages = ['coucou', 'yeah']
      const game = {
        id: gameId,
        kind: 'belote',
        meshes,
        players: [player],
        hands,
        cameras: [],
        messages
      }
      engine.serialize.mockReturnValueOnce({ meshes, handMeshes: [] })
      serializeThread.mockReturnValueOnce(messages)
      runMutation.mockResolvedValueOnce(game)
      await joinGame({ gameId, player, turnCredentials })
      expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
        gameId,
        parameters: undefined
      })
      expect(runMutation).toHaveBeenCalledOnce()
      expect(engine.load).toHaveBeenCalledWith(
        game,
        player.id,
        buildPlayerColors(game),
        true
      )
      expect(engine.load).toHaveBeenCalledOnce()
      expect(loadCameraSaves).not.toHaveBeenCalled()
      expect(send).toHaveBeenCalledWith(
        { type: 'game-sync', ...game, selections: [] },
        undefined
      )
      expect(send).toHaveBeenCalledOnce()
    })

    it('loads game data without player hand', async () => {
      const gameId = faker.datatype.uuid()
      const meshes = [{ id: 'mesh2' }]
      const game = {
        id: gameId,
        kind: 'belote',
        meshes,
        players: [player],
        hands: []
      }
      engine.serialize.mockReturnValueOnce({ meshes, handMeshes: [] })
      runMutation.mockResolvedValueOnce(game)
      await joinGame({ gameId, player, turnCredentials })
      expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
        gameId,
        parameters: undefined
      })
      expect(runMutation).toHaveBeenCalledOnce()
      expect(engine.load).toHaveBeenCalledWith(
        game,
        player.id,
        buildPlayerColors(game),
        true
      )
      expect(engine.load).toHaveBeenCalledOnce()
      expect(playerColorReceived).toHaveBeenLastCalledWith(
        findPlayerColor(game, player.id)
      )
    })

    it('does not become host when being the only guest with game parameters', async () => {
      const gameId = faker.datatype.uuid()
      const game = {
        id: gameId,
        kind: 'belote',
        players: [{ ...player, isGuest: true }],
        schemaString: '{}'
      }
      runMutation.mockResolvedValueOnce(game)
      expect(await joinGame({ gameId, player, turnCredentials })).toEqual(game)
      expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
        gameId,
        parameters: undefined
      })
      expect(runMutation).toHaveBeenCalledOnce()
      expect(engine.load).not.toHaveBeenCalled()
      expect(loadCameraSaves).not.toHaveBeenCalled()
      expect(loadThread).not.toHaveBeenCalled()
      expect(connectWith).not.toHaveBeenCalled()
      expect(send).not.toHaveBeenCalled()
      expect(openChannels).toHaveBeenCalledWith(player, turnCredentials, gameId)
      expect(toastReceived).not.toHaveBeenCalled()
    })

    it('sends selected parameters', async () => {
      const gameId = faker.datatype.uuid()
      const game = {
        id: gameId,
        kind: 'belote',
        players: [{ ...player, isGuest: true }],
        schemaString: '{}'
      }
      const parameters = { side: 'white' }
      runMutation.mockResolvedValueOnce(game)
      expect(
        await joinGame({ gameId, player, turnCredentials, parameters })
      ).toEqual(game)
      expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
        gameId,
        parameters: JSON.stringify(parameters)
      })
      expect(runMutation).toHaveBeenCalledOnce()
      expect(engine.load).not.toHaveBeenCalled()
      expect(loadCameraSaves).not.toHaveBeenCalled()
      expect(loadThread).not.toHaveBeenCalled()
      expect(connectWith).not.toHaveBeenCalled()
      expect(send).not.toHaveBeenCalled()
      expect(openChannels).toHaveBeenCalledWith(player, turnCredentials, gameId)
      expect(toastReceived).not.toHaveBeenCalled()
    })

    describe('with a loaded game', () => {
      const meshes = [{ id: 'mesh1' }, { id: 'mesh2' }, { id: 'mesh3' }]
      const game = {
        id: faker.datatype.uuid(),
        kind: 'belote',
        meshes,
        players: [player, partner1],
        hands: [{ playerId: partner2.id, meshes: [{ id: 'mesh4' }] }],
        cameras: [
          { playerId: player.id, index: 0 },
          { playerId: partner1.id, index: 0 }
        ],
        messages: [],
        zoomSpec: { min: 4, initial: 15 },
        tableSpec: { width: 75, height: 50 },
        preferences: [
          { playerId: partner1.id, color: '#0000ff' },
          { playerId: player.id, color: '#00ff00' },
          { playerId: partner2.id, color: '#ffffff' }
        ]
      }

      beforeEach(async () => {
        vi.useFakeTimers()
        prepareGame(game)
        selectedMeshes.next([])
        engine.serialize.mockReturnValue({
          ...game,
          meshes,
          handMeshes: []
        })
        await joinGame({
          gameId: game.id,
          player,
          turnCredentials,
          onPromotion: promotionReceived,
          onDeletion: deletionReceived
        })
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
        expect(engine.serialize).toHaveBeenCalledOnce()
        expect(serializeThread).toHaveBeenCalledOnce()
        expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
          new Map([
            [
              player.id,
              {
                ...player,
                ...findPlayerPreferences(game, player.id),
                isHost: true,
                playing: true
              }
            ],
            [
              partner1.id,
              {
                ...partner1,
                ...findPlayerPreferences(game, partner1.id),
                isHost: false,
                playing: true
              }
            ]
          ])
        )
        expect(runMutation).not.toHaveBeenCalled()
        expect(toastReceived).toHaveBeenCalledWith({
          content: translate('labels.player-joined-game', { player: partner1 }),
          icon: 'person_add_alt_1'
        })
        expect(toastReceived).toHaveBeenCalledOnce()
      })

      it('sends game data to newly invited player', async () => {
        runMutation.mockResolvedValueOnce({
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
        expect(engine.serialize).toHaveBeenCalledOnce()
        expect(serializeThread).toHaveBeenCalledOnce()
        expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
          new Map([
            [
              player.id,
              {
                ...player,
                ...findPlayerPreferences(game, player.id),
                isHost: true,
                playing: true
              }
            ],
            [
              partner1.id,
              {
                ...partner1,
                ...findPlayerPreferences(game, partner1.id),
                isHost: false,
                playing: false
              }
            ],
            [
              partner2.id,
              {
                ...partner2,
                ...findPlayerPreferences(game, partner2.id),
                isHost: false,
                playing: true
              }
            ]
          ])
        )
        expect(toastReceived).toHaveBeenCalledWith({
          content: translate('labels.player-joined-game', { player: partner2 }),
          icon: 'person_add_alt_1'
        })
        expect(toastReceived).toHaveBeenCalledOnce()
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
            kind: undefined,
            zoomSpec: undefined,
            tableSpec: undefined,
            players: undefined,
            preferences: undefined
          }
        })
        expect(runMutation).toHaveBeenCalledOnce()
        expect(engine.serialize).toHaveBeenCalledOnce()
        expect(send).toHaveBeenCalledWith(
          {
            type: 'game-sync',
            ...game,
            hands,
            selections: [{ playerId: player.id, selectedIds: [] }]
          },
          undefined
        )
        expect(send).toHaveBeenCalledOnce()
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
        expect(runMutation).toHaveBeenCalledOnce()
        expect(serializeThread).toHaveBeenCalledOnce()
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
        expect(runMutation).toHaveBeenCalledOnce()
        expect(serializeThread).toHaveBeenCalledOnce()
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
        expect(runMutation).toHaveBeenCalledOnce()
        expect(serializeThread).toHaveBeenCalledOnce()
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
        expect(runMutation).toHaveBeenCalledOnce()
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
        expect(runMutation).toHaveBeenCalledOnce()
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
        expect(runMutation).toHaveBeenCalledOnce()
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
        expect(runMutation).toHaveBeenCalledOnce()
        expect(engine.serialize).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
      })

      it('merges and shares current player selections', async () => {
        selectedMeshes.next([{ id: 'mesh1' }, { id: 'mesh3' }, { id: 'mesh2' }])
        await connectPeerAndExpectGameSync(
          {
            ...game,
            selections: [
              { playerId: player.id, selectedIds: ['mesh1', 'mesh3', 'mesh2'] }
            ],
            hands: [...game.hands, { playerId: player.id, meshes: [] }]
          },
          partner1.id
        )
      })

      it('merges and shares remote peer selections', async () => {
        selectedMeshes.next([{ id: 'mesh1' }])
        remoteSelection.next({
          selectedIds: ['mesh2', 'mesh3'],
          playerId: partner2.id
        })
        await connectPeerAndExpectGameSync(
          {
            ...game,
            selections: [
              { playerId: player.id, selectedIds: ['mesh1'] },
              { playerId: partner2.id, selectedIds: ['mesh2', 'mesh3'] }
            ],
            hands: [...game.hands, { playerId: player.id, meshes: [] }]
          },
          partner1.id
        )
      })

      it('notifies of game deletion from server', async () => {
        gameUpdates$.next(null)
        await nextPromise()
        expect(deletionReceived).toHaveBeenCalledOnce()
        expect(promotionReceived).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
        expect(playerColorReceived).toHaveLastReturnedWith()
        expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(new Map())
      })

      it('keeps peer channels when joining the same game', async () => {
        await joinGame({
          gameId: game.id,
          player,
          turnCredentials,
          onPromotion: promotionReceived,
          onDeletion: deletionReceived
        })
        expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
          gameId: game.id,
          parameters: undefined
        })
        expect(runMutation).toHaveBeenCalledOnce()
        expect(runSubscription).toHaveBeenCalledWith(
          graphQL.receiveGameUpdates,
          {
            gameId: game.id
          }
        )
        expect(runSubscription).toHaveBeenCalledOnce()
        expect(engine.load).toHaveBeenCalledWith(
          game,
          player.id,
          buildPlayerColors(game),
          true
        )
        expect(engine.load).toHaveBeenCalledOnce()
        expect(loadCameraSaves).toHaveBeenCalledWith(game.cameras.slice(0, 1))
        expect(loadCameraSaves).toHaveBeenCalledOnce()
        expect(loadThread).toHaveBeenCalledWith(game.messages)
        expect(loadThread).toHaveBeenCalledOnce()
        expect(connectWith).not.toHaveBeenCalled()
        expect(send).toHaveBeenCalledWith(
          {
            type: 'game-sync',
            ...game,
            hands: [...game.hands, { meshes: [], playerId: player.id }],
            selections: []
          },
          undefined
        )
        expect(send).toHaveBeenCalledOnce()
        expect(openChannels).not.toHaveBeenCalled()
        expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
          new Map([
            [
              player.id,
              { ...player, isHost: true, playing: true, color: '#00ff00' }
            ],
            [
              partner1.id,
              { ...partner1, isHost: false, playing: false, color: '#0000ff' }
            ]
          ])
        )
        expect(playerColorReceived).toHaveBeenLastCalledWith(
          findPlayerColor(game, player.id)
        )
        expect(toastReceived).not.toHaveBeenCalled()
      })

      describe('leaveGame()', () => {
        it('saves game data', async () => {
          leaveGame(player)
          const hands = [...game.hands, { playerId: player.id, meshes: [] }]
          expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
            game: {
              ...game,
              cameras: [...game.cameras],
              hands,
              kind: undefined,
              zoomSpec: undefined,
              tableSpec: undefined,
              players: undefined,
              preferences: undefined
            }
          })
          expect(runMutation).toHaveBeenCalledOnce()
          expect(engine.serialize).toHaveBeenCalledOnce()
          expect(send).not.toHaveBeenCalled()
          expect(playerColorReceived).toHaveLastReturnedWith()
          expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(new Map())
        })
      })
    })

    describe('with online players', () => {
      const meshes = [{ id: 'mesh1' }, { id: 'mesh2' }, { id: 'mesh3' }]
      const id = faker.datatype.uuid()
      const game = {
        id,
        kind: 'belote',
        meshes,
        players: [
          { currentGameId: faker.datatype.uuid(), ...partner3 },
          { currentGameId: id, ...player },
          { currentGameId: id, ...partner1 },
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
        messages: ['coucou', 'yeah'],
        preferences: [
          { playerId: partner1.id, color: '#0000ff' },
          { playerId: partner2.id, color: '#ffffff' },
          { playerId: player.id, color: '#00ff00' }
        ]
      }

      beforeEach(() => prepareGame(game))

      it.skip('fails when not receiving game from online players', async () => {
        error.mockImplementationOnce(() => {})
        const errorMessage = 'No game data after 30s'
        const promise = joinGame({
          gameId: game.id,
          player: partner2,
          turnCredentials
        })
        await nextPromise()
        await nextPromise()
        await nextPromise()
        vi.runAllTimers()
        await expect(promise).rejects.toThrow(errorMessage)
        expect(error).toHaveBeenCalledWith(errorMessage)
        expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
          gameId: game.id,
          parameter: undefined
        })
        expect(runMutation).toHaveBeenCalledOnce()
        expect(connectWith).toHaveBeenCalledWith(player.id, turnCredentials)
        expect(connectWith).toHaveBeenCalledWith(partner1.id, turnCredentials)
        expect(connectWith).toHaveBeenCalledTimes(2)
        expect(engine.load).not.toHaveBeenCalled()
        expect(loadCameraSaves).not.toHaveBeenCalled()
        expect(loadThread).not.toHaveBeenCalled()
        expect(send).not.toHaveBeenCalled()
        expect(closeChannels).toHaveBeenCalledTimes(2)
      })

      it('connects to peers when being guest with game parameters', async () => {
        const gameParameters = {
          ...game,
          players: [
            { currentGameId: id, ...player },
            { currentGameId: id, ...partner1 },
            { isGuest: true, ...partner2 },
            { currentGameId: faker.datatype.uuid(), ...partner3 }
          ],
          schemaString: '{}'
        }
        runMutation.mockReset().mockResolvedValueOnce(gameParameters)
        expect(
          await joinGame({ gameId: game.id, player: partner2, turnCredentials })
        ).toEqual(gameParameters)
        expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
          gameId: game.id,
          parameters: undefined
        })
        expect(runMutation).toHaveBeenCalledOnce()
        expect(engine.load).not.toHaveBeenCalled()
        expect(loadCameraSaves).not.toHaveBeenCalled()
        expect(loadThread).not.toHaveBeenCalled()
        expect(connectWith).toHaveBeenCalledWith(player.id, turnCredentials)
        expect(connectWith).toHaveBeenCalledWith(partner1.id, turnCredentials)
        expect(connectWith).toHaveBeenCalledTimes(2)
        expect(send).not.toHaveBeenCalled()
        expect(openChannels).toHaveBeenCalledWith(
          partner2,
          turnCredentials,
          game.id
        )
        expect(toastReceived).not.toHaveBeenCalled()
      })

      describe('with loaded game for peers', () => {
        beforeEach(async () => {
          engine.serialize.mockResolvedValue({})
          connectWith.mockImplementationOnce(async () => {
            await nextPromise()
            lastMessageReceived.next({
              data: { type: 'game-sync', ...game },
              playerId: partner1.id
            })
          })
          await joinGame({
            gameId: game.id,
            player: partner2,
            turnCredentials,
            onPromotion: promotionReceived,
            onDeletion: deletionReceived
          })
        })

        it('loads game data from online players', async () => {
          expect(runMutation).toHaveBeenCalledWith(graphQL.joinGame, {
            gameId: game.id,
            parameters: undefined
          })
          expect(runMutation).toHaveBeenCalledOnce()
          expect(connectWith).toHaveBeenCalledWith(player.id, turnCredentials)
          expect(connectWith).toHaveBeenCalledWith(partner1.id, turnCredentials)
          expect(connectWith).toHaveBeenCalledTimes(2)
          expect(send).not.toHaveBeenCalled()
          expect(engine.load).toHaveBeenCalledWith(
            game,
            partner2.id,
            buildPlayerColors(game),
            true
          )
          expect(engine.load).toHaveBeenCalledOnce()
          expect(loadCameraSaves).toHaveBeenCalledWith(game.cameras.slice(2))
          expect(loadCameraSaves).toHaveBeenCalledOnce()
          expect(loadThread).toHaveBeenCalledWith(game.messages)
          expect(loadThread).toHaveBeenCalledOnce()
          expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
            new Map(
              game.players.map(gamer => [
                gamer.id,
                {
                  ...gamer,
                  currentGameId: undefined,
                  ...findPlayerPreferences(game, gamer.id),
                  isHost: gamer.id === partner1.id,
                  playing: gamer.id === partner2.id
                }
              ])
            )
          )
          expect(runSubscription).toHaveBeenCalledWith(
            graphQL.receiveGameUpdates,
            { gameId: game.id }
          )
          expect(runSubscription).toHaveBeenCalledOnce()
        })

        it('share hand with other peers', async () => {
          vi.clearAllMocks()
          const handMeshes = meshes.slice(0, 1)
          handMeshes$.next(handMeshes)
          expect(engine.serialize).not.toHaveBeenCalled()
          expect(send).toHaveBeenCalledWith({
            meshes: handMeshes,
            playerId: partner2.id,
            type: 'saveHand'
          })
          expect(send).toHaveBeenCalledOnce()
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
            playerId: partner2.id,
            type: 'saveCameras'
          })
          expect(send).toHaveBeenCalledOnce()
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
              playerId: player.id
            })
          })
          await joinGame({
            gameId: game.id,
            player: partner2,
            turnCredentials,
            onPromotion: promotionReceived,
            onDeletion: deletionReceived
          })
          vi.clearAllMocks()
        })

        it('takes host role when being the first online', async () => {
          serializeThread.mockReturnValueOnce([])
          engine.serialize.mockReturnValueOnce({
            meshes: game.meshes,
            handMeshes: []
          })
          lastDisconnectedId.next(player.id)
          await nextPromise()
          expect(send).toHaveBeenCalledWith(
            {
              type: 'game-sync',
              id: game.id,
              ...game,
              hands: [...game.hands, { playerId: partner2.id, meshes: [] }],
              messages: [],
              selections: []
            },
            undefined
          )
          expect(send).toHaveBeenCalledOnce()
          expect(closeChannels).not.toHaveBeenCalled()
          expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
            new Map([
              [
                partner3.id,
                {
                  ...partner3,
                  ...findPlayerPreferences(game, partner3.id),
                  isHost: false,
                  playing: false
                }
              ],
              [
                player.id,
                {
                  ...player,
                  ...findPlayerPreferences(game, player.id),
                  isHost: false,
                  playing: false
                }
              ],
              [
                partner1.id,
                {
                  ...partner1,
                  ...findPlayerPreferences(game, partner1.id),
                  isHost: false,
                  playing: false
                }
              ],
              [
                partner2.id,
                {
                  ...partner2,
                  ...findPlayerPreferences(game, partner2.id),

                  isHost: true,
                  playing: true
                }
              ]
            ])
          )
          expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(3)
          expect(runSubscription).toHaveBeenCalledWith(
            graphQL.receiveGameUpdates,
            { gameId: game.id }
          )
          expect(runSubscription).toHaveBeenCalledOnce()
          expect(toastReceived).toHaveBeenCalledWith({
            content: translate('labels.player-left-game', { player }),
            icon: 'person_remove'
          })
          expect(toastReceived).toHaveBeenCalledOnce()

          vi.clearAllMocks()
          const newcamera = { pos: 'a' }
          cameraSaves.next([newcamera])
          expect(runMutation).toHaveBeenCalledWith(graphQL.saveGame, {
            game: {
              id: game.id,
              cameras: [
                game.cameras[0],
                game.cameras[1],
                { playerId: partner2.id, index: 0, ...newcamera }
              ]
            }
          })
          expect(runMutation).toHaveBeenCalledOnce()
        })

        it('does not take host role when not being the first online', async () => {
          lastConnectedId.next(partner1.id)
          toastReceived.mockClear()
          lastDisconnectedId.next(player.id)
          await nextPromise()
          expect(send).not.toHaveBeenCalled()
          expect(gamePlayerByIdReceived).toHaveBeenLastCalledWith(
            new Map([
              [
                partner3.id,
                {
                  ...partner3,
                  ...findPlayerPreferences(game, partner3.id),
                  isHost: false,
                  playing: false
                }
              ],
              [
                player.id,
                {
                  ...player,
                  ...findPlayerPreferences(game, player.id),
                  // this player will not be host when the new host will send their first update
                  isHost: true,
                  playing: false
                }
              ],
              [
                partner1.id,
                {
                  ...partner1,
                  ...findPlayerPreferences(game, partner1.id),
                  // this player will become host when they'll send their first update
                  isHost: false,
                  playing: true
                }
              ],
              [
                partner2.id,
                {
                  ...partner2,
                  ...findPlayerPreferences(game, partner2.id),
                  isHost: false,
                  playing: true
                }
              ]
            ])
          )
          expect(gamePlayerByIdReceived).toHaveBeenCalledTimes(3)
          expect(runSubscription).not.toHaveBeenCalled()
          expect(toastReceived).toHaveBeenCalledWith({
            content: translate('labels.player-left-game', { player }),
            icon: 'person_remove'
          })
          expect(toastReceived).toHaveBeenCalledOnce()
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
    const guest2 = { id: faker.datatype.uuid() }

    it('invites a given user to a game', async () => {
      runMutation.mockResolvedValueOnce(game)
      expect(await invite(game.id, guest.id)).toBeUndefined()
      expect(runMutation).toHaveBeenCalledWith(graphQL.invite, {
        gameId: game.id,
        playerIds: [guest.id]
      })
      expect(runMutation).toHaveBeenCalledOnce()
      expect(engine.load).not.toHaveBeenCalled()
    })

    it('can invite multiple guests', async () => {
      runMutation.mockResolvedValueOnce()
      expect(await invite(game.id, guest.id, guest2.id)).toBeUndefined()
      expect(runMutation).toHaveBeenCalledWith(graphQL.invite, {
        gameId: game.id,
        playerIds: [guest.id, guest2.id]
      })
      expect(runMutation).toHaveBeenCalledOnce()
      expect(engine.load).not.toHaveBeenCalled()
    })
  })
})

describe('createGame()', () => {
  it('creates a game', async () => {
    const kind = faker.lorem.word()
    const id = faker.datatype.uuid()
    runMutation.mockResolvedValueOnce({ id })
    expect(await createGame(kind)).toEqual({ id })
    expect(runMutation).toHaveBeenCalledWith(graphQL.createGame, { kind })
    expect(runMutation).toHaveBeenCalledOnce()
  })
})

describe('promoteGame()', () => {
  it('promotes a lobby', async () => {
    const kind = faker.lorem.word()
    const id = faker.datatype.uuid()
    runMutation.mockResolvedValueOnce({ id })
    expect(await promoteGame(id, kind)).toEqual({ id })
    expect(runMutation).toHaveBeenCalledWith(graphQL.promoteGame, {
      gameId: id,
      kind
    })
    expect(runMutation).toHaveBeenCalledOnce()
  })
})

describe('deleteGame()', () => {
  it('deletes a game', async () => {
    const gameId = faker.datatype.uuid()
    expect(await deleteGame(gameId)).toBeUndefined()
    expect(runMutation).toHaveBeenCalledWith(graphQL.deleteGame, { gameId })
    expect(runMutation).toHaveBeenCalledOnce()
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
    expect(runQuery).toHaveBeenCalledOnce()
  })
})

describe('receiveGameListUpdates()', () => {
  const games = [
    { id: faker.datatype.uuid(), created: faker.date.past().getTime() },
    { id: faker.datatype.uuid(), created: faker.date.past().getTime() },
    { id: faker.datatype.uuid(), created: faker.date.past().getTime() }
  ]

  it('initializes observable with provided list', () => {
    runSubscription.mockReturnValueOnce(new Subject())
    const gameList$ = receiveGameListUpdates(games.slice(0, 1))
    expect(get(gameList$)).toEqual(games.slice(0, 1))
  })

  it('updates observable with received list and notify for new games', () => {
    runSubscription.mockReset()
    const updatesReceived = vi.fn()
    const sendUpdate = new Subject()
    runSubscription.mockReturnValueOnce(sendUpdate)
    const gameList$ = receiveGameListUpdates()
    gameList$.subscribe(updatesReceived)
    expect(updatesReceived).toHaveBeenCalledWith([])
    expect(updatesReceived).toHaveBeenCalledOnce()

    sendUpdate.next(games)
    expect(updatesReceived).toHaveBeenNthCalledWith(2, games)
    expect(updatesReceived).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenCalledWith({
      contentKey: 'labels.new-game-invite'
    })
    expect(notify).toHaveBeenCalledOnce()
  })

  it('does not notify when receiving a list with same games', () => {
    runSubscription.mockReset()
    const updatesReceived = vi.fn()
    const sendUpdate = new Subject()
    runSubscription.mockReturnValueOnce(sendUpdate)
    const gameList$ = receiveGameListUpdates(games)
    gameList$.subscribe(updatesReceived)

    sendUpdate.next(games)
    expect(updatesReceived).toHaveBeenLastCalledWith(games)
    expect(updatesReceived).toHaveBeenCalledTimes(2)
    expect(notify).not.toHaveBeenCalled()
  })
})

async function connectPeerAndExpectGameSync(
  { cameras, selections, ...gameData },
  playerId
) {
  send.mockReset()
  lastConnectedId.next(playerId)
  await nextPromise()
  expect(send).toHaveBeenCalledWith(
    {
      type: 'game-sync',
      cameras: [...cameras].sort((a, b) => +a.index - +b.index),
      ...gameData,
      selections: selections ?? [
        { playerId: gameData.players[0].id, selectedIds: [] }
      ]
    },
    playerId
  )
  expect(send).toHaveBeenCalledOnce()
}

function prepareGame(game) {
  engine.onDisposeObservable.notifyObservers()
  runSubscription.mockReset()
  runSubscription.mockImplementation(subscription =>
    subscription === graphQL.receiveGameUpdates ? gameUpdates$ : null
  )
  runMutation.mockResolvedValue({
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
