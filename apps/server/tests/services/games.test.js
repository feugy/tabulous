import { faker } from '@faker-js/faker'
import { jest } from '@jest/globals'
import { join } from 'path'
import repositories from '../../src/repositories/index.js'
import {
  createGame,
  deleteGame,
  gameListsUpdate,
  invite,
  listGames,
  loadGame,
  saveGame
} from '../../src/services/games.js'
import { sleep } from '../../src/utils/time.js'

describe('given a subscription to game lists and an initialized repository', () => {
  const updates = []
  let subscription
  const player = { id: faker.datatype.uuid() }
  const peer = { id: faker.datatype.uuid() }
  let game

  beforeAll(async () => {
    subscription = gameListsUpdate.subscribe(update => updates.push(update))
    await repositories.games.connect({})
    await repositories.players.connect({})
    await repositories.catalogItems.connect({
      path: join('tests', 'fixtures', 'games')
    })
    await repositories.players.save(player)
    await repositories.players.save(peer)
  })

  afterAll(async () => {
    subscription?.unsubscribe()
    await repositories.games.release()
    await repositories.players.release()
    await repositories.catalogItems.release()
  })

  beforeEach(() => {
    jest.restoreAllMocks()
    updates.splice(0, updates.length)
  })

  afterEach(async () => deleteGame(game?.id, player.id))

  describe('createGame()', () => {
    it('throws an error on unknown game', async () => {
      const kind = faker.lorem.word()
      await expect(createGame(kind, faker.datatype.uuid())).rejects.toThrow(
        `Unsupported game ${kind}`
      )
      expect(updates).toHaveLength(0)
    })

    it('throws an error on restricted game', async () => {
      const kind = 'splendor'
      await expect(createGame(kind, faker.datatype.uuid())).rejects.toThrow(
        `Access to game ${kind} is restricted`
      )
      expect(updates).toHaveLength(0)
    })

    it('creates a game from descriptor and trigger list update', async () => {
      const kind = 'klondike'
      game = await createGame(kind, player.id)
      expect(game).toEqual({
        id: expect.any(String),
        created: expect.any(Number),
        kind,
        locales: expect.any(Object),
        playerIds: [player.id],
        meshes: expect.any(Array),
        cameras: [],
        messages: [],
        hands: []
      })
      await sleep()
      expect(updates).toEqual([{ playerId: player.id, games: [game] }])
    })

    it(`invokes descriptor's addPlayer when creating game`, async () => {
      const kind = 'belote'
      game = await createGame(kind, player.id)
      expect(game).toEqual({
        id: expect.any(String),
        created: expect.any(Number),
        kind,
        locales: expect.any(Object),
        playerIds: [player.id],
        meshes: expect.any(Array),
        cameras: [],
        messages: [],
        hands: [{ playerId: player.id, meshes: [] }]
      })
      await sleep()
      expect(updates).toEqual([
        { playerId: player.id, games: expect.arrayContaining([game]) }
      ])
    })
  })

  describe('given an existing game', () => {
    beforeEach(async () => {
      game = await createGame('klondike', player.id)
      await sleep()
      updates.splice(0, updates.length)
    })

    describe('loadGame()', () => {
      it('returns null on unknown game', async () => {
        expect(await loadGame(faker.datatype.uuid(), player.id)).toBeNull()
      })

      it('returns null on un-owned game', async () => {
        expect(await loadGame(game.id, faker.datatype.uuid())).toBeNull()
      })

      it('returns an existing, owned game', async () => {
        expect(await loadGame(game.id, player.id)).toEqual(game)
      })
    })

    describe('saveGame()', () => {
      it('returns null on unknown game', async () => {
        expect(
          await saveGame({ id: faker.datatype.uuid() }, player.id)
        ).toBeNull()
      })

      it('returns null on un-owned game', async () => {
        expect(await saveGame(game, faker.datatype.uuid())).toBeNull()
      })

      it('can save scene', async () => {
        const meshes = [...game.meshes, game.meshes[0]]
        expect(await saveGame({ id: game.id, meshes }, player.id)).toEqual({
          ...game,
          meshes: [game.meshes[0], game.meshes[0]],
          cameras: [],
          messages: []
        })
      })

      it('can save player hands', async () => {
        const hands = [{ playerId: player.id, meshes: [game.meshes[0]] }]
        expect(await saveGame({ id: game.id, hands }, player.id)).toEqual({
          ...game,
          hands: [{ playerId: player.id, meshes: [game.meshes[0]] }],
          cameras: [],
          messages: []
        })
      })

      it('can save messages', async () => {
        const messages = [
          { playerId: player.id, text: 'test!', time: Date.now() }
        ]
        expect(await saveGame({ id: game.id, messages }, player.id)).toEqual({
          ...game,
          cameras: [],
          messages
        })
      })

      it('can save cameras', async () => {
        const cameras = [
          {
            playerId: player.id,
            index: 0,
            target: [0, 0, 0],
            alpha: Math.PI,
            beta: 0,
            elevation: 10
          }
        ]
        expect(await saveGame({ id: game.id, cameras }, player.id)).toEqual({
          ...game,
          cameras,
          messages: []
        })
      })
    })

    describe('invite()', () => {
      it('returns null on unknown game', async () => {
        expect(
          await invite(faker.datatype.uuid(), peer.id, player.id)
        ).toBeNull()
        expect(updates).toHaveLength(0)
      })

      it('returns null on un-owned game', async () => {
        expect(await invite(game.id, peer.id, faker.datatype.uuid())).toBeNull()
        expect(updates).toHaveLength(0)
      })

      it('returns null on unknown guest id', async () => {
        jest.spyOn(repositories.players, 'getById').mockResolvedValue(null)
        expect(
          await invite(game.id, faker.datatype.uuid(), player.id)
        ).toBeNull()
        expect(updates).toHaveLength(0)
      })

      it(`adds guest id to game's player id list and trigger list updates`, async () => {
        const updated = await invite(game.id, peer.id, player.id)
        expect(updated).toEqual({
          ...game,
          playerIds: [player.id, peer.id]
        })
        // only once
        expect(await invite(game.id, peer.id, player.id)).toEqual(null)
        expect((await loadGame(game.id, player.id)).playerIds).toEqual([
          player.id,
          peer.id
        ])
        expect(updates).toEqual([
          { playerId: player.id, games: [updated] },
          { playerId: peer.id, games: [updated] }
        ])
      })

      it(`invokes descriptor's addPayer`, async () => {
        await deleteGame(game.id, player.id)
        game = await createGame('belote', player.id)
        await sleep()
        const updated = await invite(game.id, peer.id, player.id)
        expect(updated.hands).toEqual([
          ...game.hands,
          { playerId: peer.id, meshes: [] }
        ])
      })
    })

    describe('listGames()', () => {
      const games = []
      const getId = ({ id }) => id

      beforeEach(async () => {
        games.push(game)
        await invite(games[0].id, peer.id, player.id)

        games.push(await createGame('belote', player.id))

        games.push(await createGame('klondike', player.id))

        games.push(await createGame('belote', peer.id))
        await invite(games[3].id, player.id, peer.id)

        games.push(await createGame('belote', peer.id))
      })

      afterEach(async () => {
        for (const {
          id,
          playerIds: [ownerId]
        } of games) {
          await deleteGame(id, ownerId)
        }
        games.splice(0, games.length)
      })

      it('can return an empty list', async () => {
        expect(await listGames(faker.datatype.uuid())).toEqual([])
      })

      it('returns all game of a player', async () => {
        expect((await listGames(player.id)).map(getId)).toEqual(
          [games[0], games[1], games[2], games[3]].map(getId)
        )

        expect((await listGames(peer.id)).map(getId)).toEqual(
          [games[0], games[3], games[4]].map(getId)
        )
      })
    })

    describe('deleteGame()', () => {
      it('returns null on unknown game', async () => {
        expect(await deleteGame(faker.datatype.uuid(), player.id)).toBeNull()
        expect(updates).toHaveLength(0)
      })

      it('returns null on un-owned game', async () => {
        expect(await deleteGame(game.id, faker.datatype.uuid())).toBeNull()
        expect(await loadGame(game.id, player.id)).toBeDefined()
        expect(updates).toHaveLength(0)
      })

      it('returns deleted game and trigger list update', async () => {
        expect(await deleteGame(game.id, player.id)).toEqual(game)
        expect(await loadGame(game.id, player.id)).toBeNull()
        expect(updates).toEqual([{ playerId: player.id, games: [] }])
      })
    })
  })
})
