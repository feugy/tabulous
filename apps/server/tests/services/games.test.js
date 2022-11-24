import { faker } from '@faker-js/faker'
import { join } from 'path'
import { setTimeout } from 'timers/promises'
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

import repositories from '../../src/repositories/index.js'
import { grantAccess, revokeAccess } from '../../src/services/catalog.js'
import {
  countOwnGames,
  createGame,
  deleteGame,
  gameListsUpdate,
  invite,
  joinGame,
  listGames,
  notifyRelatedPlayers,
  saveGame
} from '../../src/services/games.js'
import { clearDatabase, getRedisTestUrl } from '../test-utils.js'

describe('given a subscription to game lists and an initialized repository', () => {
  const redisUrl = getRedisTestUrl()
  const updates = []
  let subscription
  const player = { id: 'player' }
  const peer = { id: 'peer-1' }
  const peer2 = { id: 'peer-2' }
  let game

  beforeAll(async () => {
    subscription = gameListsUpdate.subscribe(update => updates.push(update))
    await repositories.games.connect({ url: redisUrl })
    await repositories.players.connect({ url: redisUrl })
    await repositories.players.save([player, peer, peer2])
  })

  afterAll(async () => {
    subscription?.unsubscribe()
    await repositories.games.release()
    await repositories.players.release()
    await repositories.catalogItems.release()
    await clearDatabase(redisUrl)
  })

  beforeEach(async () => {
    await repositories.catalogItems.connect({
      path: join('tests', 'fixtures', 'games')
    })
    await revokeAccess(player.id, 'splendor')
    vi.restoreAllMocks()
    updates.splice(0, updates.length)
  })

  afterEach(async () => repositories.games.deleteById(game?.id))

  describe('createGame()', () => {
    it('throws an error on unknown game', async () => {
      const kind = faker.lorem.word()
      await expect(createGame(kind, player)).rejects.toThrow(
        `Unsupported game ${kind}`
      )
      await setTimeout(50)
      expect(updates).toHaveLength(0)
    })

    it('throws an error on restricted game', async () => {
      const kind = 'splendor'
      await expect(createGame(kind, player)).rejects.toThrow(
        `Access to game ${kind} is restricted`
      )
      await setTimeout(50)
      expect(updates).toHaveLength(0)
    })

    it('throws an error when cap reached', async () => {
      const player = { id: faker.datatype.uuid() }
      const kind = 'klondike'
      const actualCount = 10
      for (let rank = 0; rank < actualCount; rank++) {
        await repositories.games.save({ kind, playerIds: [player.id] })
      }
      await expect(createGame(kind, player)).rejects.toThrow(
        `You own ${actualCount} games, you can not create more`
      )
      await setTimeout(50)
      expect(updates).toHaveLength(0)
    })

    it('creates a game from descriptor and trigger list update', async () => {
      const kind = 'klondike'
      game = await createGame(kind, player)
      expect(game).toEqual({
        id: expect.any(String),
        created: expect.any(Number),
        availableSeats: 2,
        kind,
        playerIds: [],
        guestIds: [player.id],
        meshes: expect.any(Array),
        cameras: [],
        messages: [],
        hands: [],
        preferences: []
      })
      await setTimeout(50)
      expect(updates).toEqual([{ playerId: player.id, games: [game] }])
    })

    it(`throws errors from descriptor's build() function`, async () => {
      vi.spyOn(console, 'error').mockImplementationOnce(() => {})
      await repositories.catalogItems.connect({
        path: join('tests', 'fixtures', 'invalid-games')
      })
      await expect(createGame('throwing', faker)).rejects.toThrow(
        `internal build error`
      )
      await setTimeout(50)
      expect(updates).toHaveLength(0)
    })
  })

  describe('countOwnedGames()', () => {
    const games = []

    afterEach(async () => {
      await repositories.games.deleteById(games.map(({ id }) => id))
      games.splice(0, games.length)
    })

    it('handles no owned games', async () => {
      await expect(await countOwnGames(player.id)).toBe(0)
    })

    it('handles unknown player', async () => {
      await expect(await countOwnGames(faker.datatype.uuid())).toBe(0)
    })

    it('counts owned games', async () => {
      const count = 4
      for (let rank = 0; rank < count; rank++) {
        games.push(await repositories.games.save({ playerIds: [player.id] }))
      }
      for (let rank = 0; rank < 3; rank++) {
        games.push(await repositories.games.save({ playerIds: [peer.id] }))
      }
      await expect(await countOwnGames(player.id)).toBe(count)
    })

    it('ignores invitations', async () => {
      const count = 3
      games.push(
        await repositories.games.save({ playerIds: [peer.id, player.id] })
      )
      for (let rank = 0; rank < count; rank++) {
        games.push(await repositories.games.save({ playerIds: [player.id] }))
      }
      games.push(
        await repositories.games.save({ playerIds: [peer.id, player.id] })
      )
      await expect(await countOwnGames(player.id)).toBe(count)
    })
  })

  describe('given a created game', () => {
    beforeEach(async () => {
      game = await createGame('belote', player)
      expect(game).toMatchObject({
        availableSeats: 2,
        playerIds: [],
        guestIds: [player.id],
        preferences: []
      })
      await setTimeout(50)
      updates.splice(0)
    })

    describe('joinGame()', () => {
      it('returns null on unknown game', async () => {
        expect(await joinGame(faker.datatype.uuid(), player)).toBeNull()
      })

      it('returns null on un-owned game', async () => {
        expect(await joinGame(game.id, peer2)).toBeNull()
      })

      it('automatically joins a game without parameters', async () => {
        expect(await joinGame(game.id, player)).toEqual({
          ...game,
          availableSeats: 1,
          guestIds: [],
          playerIds: [player.id],
          hands: [{ playerId: player.id, meshes: [] }],
          preferences: [{ playerId: player.id, color: expect.any(String) }]
        })
      })

      it(`invokes descriptor's addPlayer() when loading game`, async () => {
        const joinedGame = await joinGame(game.id, player)
        expect(joinedGame).toEqual({
          id: expect.any(String),
          created: expect.any(Number),
          availableSeats: 1,
          kind: game.kind,
          playerIds: [player.id],
          guestIds: [],
          meshes: expect.any(Array),
          cameras: [],
          messages: [],
          hands: [{ playerId: player.id, meshes: [] }],
          preferences: [{ playerId: player.id, color: expect.any(String) }],
          zoomSpec: { min: 5, max: 50 }
        })
        await setTimeout(50)
        expect(updates).toEqual([
          { playerId: player.id, games: expect.arrayContaining([joinedGame]) }
        ])
      })

      it('throws errors from descriptor addPlayer() function', async () => {
        await repositories.games.deleteById(game?.id)
        vi.spyOn(console, 'error').mockImplementationOnce(() => {})
        await repositories.catalogItems.connect({
          path: join('tests', 'fixtures', 'invalid-games')
        })
        game = await createGame('throwing-on-player', player)
        await setTimeout(50)
        expect(updates).toEqual([
          { playerId: player.id, games: expect.arrayContaining([game]) }
        ])
        updates.splice(0)

        await expect(joinGame(game.id, player)).rejects.toThrow(
          `internal addPlayer error`
        )
        await setTimeout(50)
        expect(updates).toEqual([])
      })
    })

    describe('given joined owner', () => {
      beforeEach(async () => {
        game = await joinGame(game.id, player)
        await setTimeout(50)
        updates.splice(0)
      })

      describe('joinGame()', () => {
        it('returns owned game', async () => {
          expect(await joinGame(game.id, player)).toEqual(game)
        })

        it(`adds guest id to game's player id and preference lists, and trigger list updates`, async () => {
          await invite(game.id, peer.id, player.id)
          await setTimeout(50)
          updates.splice(0)

          const updated = await joinGame(game.id, peer)
          expect(updated).toEqual({
            ...game,
            availableSeats: 0,
            playerIds: [player.id, peer.id],
            hands: [
              { playerId: player.id, meshes: [] },
              { playerId: peer.id, meshes: [] }
            ],
            preferences: [
              { playerId: player.id, color: expect.any(String) },
              { playerId: peer.id, color: expect.any(String) }
            ]
          })
          await setTimeout(50)
          expect(updates).toEqual([
            { playerId: player.id, games: [updated] },
            { playerId: peer.id, games: [updated] }
          ])
        })

        it('throws when the maximum number of players was reached', async () => {
          const grantedPlayer = await grantAccess(player.id, 'splendor')
          await deleteGame(game.id, grantedPlayer.id)
          game = await createGame('splendor', grantedPlayer) // it has 4 seats
          game = await joinGame(game.id, grantedPlayer)
          const guests = await repositories.players.save([
            { id: faker.datatype.uuid() },
            { id: faker.datatype.uuid() },
            { id: faker.datatype.uuid() },
            { id: faker.datatype.uuid() }
          ])
          for (const { id } of guests) {
            await invite(game.id, id, grantedPlayer.id)
          }

          let availableSeats = game.availableSeats
          let playerIds
          for (let rank = 0; rank < guests.length - 1; rank++) {
            playerIds = [
              player.id,
              ...guests.slice(0, rank + 1).map(({ id }) => id)
            ]
            expect(
              await joinGame(game.id, guests[rank]),
              `when loading guest #${rank}`
            ).toEqual({
              ...game,
              availableSeats: availableSeats - 1,
              playerIds,
              guestIds: guests.slice(rank + 1).map(({ id }) => id),
              preferences: playerIds.map(playerId => ({
                playerId,
                color: expect.any(String)
              }))
            })
            availableSeats--
          }
          await expect(
            joinGame(game.id, guests[guests.length - 1])
          ).rejects.toThrow(`no more available seats`)
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
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('returns null on un-owned game', async () => {
          expect(
            await invite(game.id, peer.id, faker.datatype.uuid())
          ).toBeNull()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('returns null on unknown guest id', async () => {
          vi.spyOn(repositories.players, 'getById').mockResolvedValue(null)
          expect(
            await invite(game.id, faker.datatype.uuid(), player.id)
          ).toBeNull()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('returns null on already invited guest', async () => {
          await invite(game.id, peer.id, player.id)
          await setTimeout(50)
          updates.splice(0)

          expect(await invite(game.id, peer.id, player.id)).toBeNull()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('returns null on invited player', async () => {
          await invite(game.id, peer.id, player.id)
          await joinGame(game.id, peer)
          await setTimeout(50)
          updates.splice(0)

          expect(await invite(game.id, peer.id, player.id)).toBeNull()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it(`adds to game's guest list and trigger list updates`, async () => {
          const updated = await invite(game.id, peer.id, player.id)
          expect(updated).toEqual({
            ...game,
            guestIds: [peer.id]
          })
          // only once
          expect(await invite(game.id, peer.id, player.id)).toEqual(null)
          const loaded = await joinGame(game.id, player)
          expect(loaded.playerIds).toEqual([player.id])
          expect(loaded.guestIds).toEqual([peer.id])
          await setTimeout(50)
          expect(updates).toEqual([
            { playerId: player.id, games: [updated] },
            { playerId: peer.id, games: [updated] }
          ])
        })
      })

      describe('listGames()', () => {
        const games = []
        const getId = ({ id }) => id

        beforeEach(async () => {
          games.push(game)
          await invite(games[0].id, peer.id, player.id)
          await joinGame(games[0].id, peer)

          games.push(await createGame('belote', player))
          await joinGame(games[1].id, player)

          games.push(await createGame('klondike', player))
          await joinGame(games[2].id, player)

          games.push(await createGame('belote', peer))
          await joinGame(games[3].id, peer)
          await invite(games[3].id, player.id, peer.id)
          await joinGame(games[3].id, player)

          games.push(await createGame('belote', peer))
          await joinGame(games[4].id, player)
        })

        afterEach(async () => {
          await repositories.games.deleteById(games.map(({ id }) => id))
          games.splice(0, games.length)
        })

        it('can return an empty list', async () => {
          expect(await listGames(faker.datatype.uuid())).toEqual([])
        })

        it('returns all game of a player', async () => {
          expect((await listGames(player.id)).map(getId)).toEqual(
            [games[0], games[1], games[2], games[3]].map(getId).sort()
          )

          expect((await listGames(peer.id)).map(getId)).toEqual(
            [games[0], games[3], games[4]].map(getId).sort()
          )
        })
      })

      describe('deleteGame()', () => {
        it('returns null on unknown game', async () => {
          expect(await deleteGame(faker.datatype.uuid(), player.id)).toBeNull()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('returns null on un-owned game', async () => {
          expect(await deleteGame(game.id, faker.datatype.uuid())).toBeNull()
          expect(await joinGame(game.id, player.id)).toBeDefined()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('returns deleted game and trigger list update', async () => {
          expect(await deleteGame(game.id, player.id)).toEqual(game)
          expect(await joinGame(game.id, player.id)).toBeNull()
          await setTimeout(50)
          expect(updates).toEqual([{ playerId: player.id, games: [] }])
        })
      })

      describe('notifyRelatedPlayers()', () => {
        const games = []

        afterEach(async () => {
          await repositories.games.deleteById(games.map(({ id }) => id))
          games.splice(0, games.length)
        })

        it('does nothing for players with no games', async () => {
          await notifyRelatedPlayers(faker.datatype.uuid())
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('does not notify the specified player', async () => {
          await notifyRelatedPlayers(player.id)
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('notifies players invited by the specified player', async () => {
          const game1 = await createGame('belote', player)
          await joinGame(game1.id, player)
          await invite(game1.id, peer.id, player.id)
          games.push(await joinGame(game1.id, peer))
          const game2 = await createGame('belote', peer2)
          await joinGame(game2.id, peer2)
          await invite(game2.id, player.id, peer2.id)
          games.push(await joinGame(game2.id, player))

          await setTimeout(50)
          updates.splice(0, updates.length)

          await notifyRelatedPlayers(player.id)
          await setTimeout(50)
          const peer1Update = updates.find(
            ({ playerId }) => playerId === peer.id
          )
          expect(peer1Update?.games).toEqual([
            expect.objectContaining(games[0])
          ])
          const peer2Update = updates.find(
            ({ playerId }) => playerId === peer2.id
          )
          expect(peer2Update?.games).toEqual([
            expect.objectContaining(games[1])
          ])
          expect(updates).toHaveLength(2)
        })

        it('does not notify the same peer multiple times', async () => {
          const game1 = await createGame('belote', player)
          await joinGame(game1.id, player)
          await invite(game1.id, peer.id, player.id)
          games.push(await joinGame(game1.id, peer))
          const game2 = await createGame('belote', player)
          await joinGame(game2.id, player)
          await invite(game2.id, peer.id, player.id)
          games.push(await joinGame(game2.id, peer))

          await setTimeout(50)
          updates.splice(0, updates.length)

          await notifyRelatedPlayers(player.id)
          await setTimeout(50)
          const peer1Update = updates.find(
            ({ playerId }) => playerId === peer.id
          )
          expect(peer1Update?.games).toContainEqual(
            expect.objectContaining(games[0])
          )
          expect(peer1Update?.games).toContainEqual(
            expect.objectContaining(games[1])
          )
          expect(peer1Update?.games).toHaveLength(2)
          expect(updates).toHaveLength(1)
        })
      })
    })
  })

  describe('given a created game with parameters', () => {
    const schema = {
      properties: {
        side: {
          enum: ['white', 'black'],
          metadata: {
            locales: {
              fr: {
                name: 'Couleur',
                side: { white: 'Blancs', black: 'Noirs' }
              }
            }
          }
        }
      }
    }

    beforeEach(async () => {
      game = await createGame('draughts', player)
      expect(game).toMatchObject({
        availableSeats: 2,
        playerIds: [],
        guestIds: [player.id],
        preferences: []
      })
      expect(game).not.toHaveProperty('askForParameters')
      await setTimeout(50)
      updates.splice(0)
    })

    describe('joinGame()', () => {
      it('returns game parameters', async () => {
        expect(await joinGame(game.id, player)).toEqual({ schema, ...game })
      })

      it('returns error and game parameters on invalid parameters', async () => {
        expect(
          await joinGame(game.id, player, { side: 'red', foo: 'bar' })
        ).toEqual({
          schema,
          error:
            '/side must be equal to one of the allowed values\n/foo must NOT have additional properties',
          ...game
        })
      })

      it('applies provided parameters', async () => {
        const side = 'black'
        expect(await joinGame(game.id, player, { side })).toEqual({
          ...game,
          availableSeats: 1,
          guestIds: [],
          playerIds: [player.id],
          preferences: [
            { playerId: player.id, color: expect.any(String), side }
          ]
        })
      })
    })
  })
})
