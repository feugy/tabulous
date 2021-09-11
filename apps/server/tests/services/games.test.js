import faker from 'faker'
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

  beforeAll(async () => {
    subscription = gameListsUpdate.subscribe(update => updates.push(update))
    await repositories.games.connect()
    await repositories.players.connect()
    await repositories.catalogItems.connect({
      path: join('tests', 'fixtures', 'games')
    })
  })

  afterAll(async () => {
    subscription?.unsubscribe()
    await repositories.games.release()
    await repositories.players.release()
    await repositories.catalogItems.release()
  })

  beforeEach(() => {
    updates.splice(0, updates.length)
  })

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
      const playerId = faker.datatype.uuid()
      const game = await createGame(kind, playerId)
      expect(game).toEqual({
        id: expect.any(String),
        created: expect.any(Number),
        kind,
        playerIds: [playerId],
        scene: {
          cards: expect.any(Array),
          roundTokens: expect.any(Array),
          roundedTiles: expect.any(Array),
          boards: expect.any(Array)
        },
        cameras: [],
        messages: []
      })
      await sleep()
      expect(updates).toEqual([{ playerId, games: [game] }])
    })
  })

  describe('given an existing game', () => {
    let game
    const playerId = faker.datatype.uuid()

    beforeEach(async () => {
      game = await createGame('belote', playerId)
      await sleep()
      updates.splice(0, updates.length)
    })

    afterEach(async () => deleteGame(game?.id, playerId))

    describe('loadGame()', () => {
      it('returns null on unknown game', async () => {
        expect(await loadGame(faker.datatype.uuid(), playerId)).toBeNull()
      })

      it('returns null on un-owned game', async () => {
        expect(await loadGame(game.id, faker.datatype.uuid())).toBeNull()
      })

      it('returns an existing, owned game', async () => {
        expect(await loadGame(game.id, playerId)).toEqual(game)
      })
    })

    describe('saveGame()', () => {
      it('returns null on unknown game', async () => {
        expect(
          await saveGame({ id: faker.datatype.uuid() }, playerId)
        ).toBeNull()
      })

      it('returns null on un-owned game', async () => {
        expect(await saveGame(game, faker.datatype.uuid())).toBeNull()
      })

      it('can save scene', async () => {
        const scene = game.scene
        scene.cards.push(scene.cards[0])
        expect(await saveGame({ id: game.id, scene }, playerId)).toEqual({
          ...game,
          scene,
          cameras: [],
          messages: []
        })
      })

      it('can save messages', async () => {
        const messages = [{ playerId, text: 'test!', time: Date.now() }]
        expect(await saveGame({ id: game.id, messages }, playerId)).toEqual({
          ...game,
          scene: game.scene,
          cameras: [],
          messages
        })
      })

      it('can save cameras', async () => {
        const cameras = [
          {
            playerId,
            index: 0,
            target: [0, 0, 0],
            alpha: Math.PI,
            beta: 0,
            elevation: 10
          }
        ]
        expect(await saveGame({ id: game.id, cameras }, playerId)).toEqual({
          ...game,
          scene: game.scene,
          cameras,
          messages: []
        })
      })
    })

    describe('invite()', () => {
      const peerId = faker.datatype.uuid()

      beforeAll(() => repositories.players.save({ id: peerId }))

      it('returns null on unknown game', async () => {
        expect(await invite(faker.datatype.uuid(), peerId, playerId)).toBeNull()
        expect(updates).toHaveLength(0)
      })

      it('returns null on un-owned game', async () => {
        expect(await invite(game.id, peerId, faker.datatype.uuid())).toBeNull()
        expect(updates).toHaveLength(0)
      })

      it('returns null on unknown guest id', async () => {
        expect(
          await invite(game.id, faker.datatype.uuid(), playerId)
        ).toBeNull()
        expect(updates).toHaveLength(0)
      })

      it(`adds guest id to game's player id list and trigger list updates`, async () => {
        const updated = await invite(game.id, peerId, playerId)
        expect(updated).toEqual({
          ...game,
          playerIds: [playerId, peerId]
        })
        // only once
        expect(await invite(game.id, peerId, playerId)).toEqual(null)
        expect((await loadGame(game.id, playerId)).playerIds).toEqual([
          playerId,
          peerId
        ])
        expect(updates).toEqual([
          { playerId, games: [updated] },
          { playerId: peerId, games: [updated] }
        ])
      })
    })

    describe('listGames()', () => {
      const peerId = faker.datatype.uuid()
      const games = []
      const getId = ({ id }) => id

      beforeAll(() =>
        repositories.players.save([{ id: peerId }, { id: playerId }])
      )

      beforeEach(async () => {
        games.push(game)
        await invite(games[0].id, peerId, playerId)

        games.push(await createGame('belote', playerId))

        games.push(await createGame('klondike', playerId))

        games.push(await createGame('belote', peerId))
        await invite(games[3].id, playerId, peerId)

        games.push(await createGame('belote', peerId))
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
        expect((await listGames(playerId)).map(getId)).toEqual(
          [games[0], games[1], games[2], games[3]].map(getId)
        )

        expect((await listGames(peerId)).map(getId)).toEqual(
          [games[0], games[3], games[4]].map(getId)
        )
      })
    })

    describe('deleteGame()', () => {
      it('returns null on unknown game', async () => {
        expect(await deleteGame(faker.datatype.uuid(), playerId)).toBeNull()
        expect(updates).toHaveLength(0)
      })

      it('returns null on un-owned game', async () => {
        expect(await deleteGame(game.id, faker.datatype.uuid())).toBeNull()
        expect(await loadGame(game.id, playerId)).toBeDefined()
        expect(updates).toHaveLength(0)
      })

      it('returns deleted game and trigger list update', async () => {
        expect(await deleteGame(game.id, playerId)).toEqual(game)
        expect(await loadGame(game.id, playerId)).toBeNull()
        expect(updates).toEqual([{ playerId, games: [] }])
      })
    })
  })
})
