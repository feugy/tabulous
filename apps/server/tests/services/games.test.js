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
  promoteGame,
  saveGame
} from '../../src/services/games.js'
import { clearDatabase, getRedisTestUrl } from '../test-utils.js'

describe('given a subscription to game lists and an initialized repository', () => {
  const redisUrl = getRedisTestUrl()
  const updates = []
  const player = { id: 'player' }
  const peer = { id: 'peer-1' }
  const peer2 = { id: 'peer-2', isAdmin: true }
  const games = []
  let game
  let lobby
  let subscription

  beforeAll(async () => {
    subscription = gameListsUpdate.subscribe(update => updates.push(update))
    await repositories.games.connect({ url: redisUrl })
    await repositories.players.connect({ url: redisUrl })
    await repositories.players.save([player, peer, peer2])
    await repositories.players.makeFriends(
      player.id,
      peer.id,
      repositories.FriendshipAccepted
    )
    await repositories.players.makeFriends(
      player.id,
      peer2.id,
      repositories.FriendshipAccepted
    )
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

  afterEach(async () => {
    await repositories.games.deleteById([
      game?.id,
      lobby?.id,
      ...games.map(({ id }) => id)
    ])
    games.splice(0, games.length)
  })

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
      const kind = 'klondike'
      const actualCount = 10
      for (let rank = 0; rank < actualCount; rank++) {
        games.push(
          await repositories.games.save({
            kind,
            ownerId: player.id,
            playerIds: [player.id]
          })
        )
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
        ownerId: player.id,
        playerIds: [],
        guestIds: [player.id],
        meshes: [
          expect.objectContaining({ texture: `/${kind}/textures/test.ktx2` })
        ],
        cameras: [],
        messages: [],
        hands: [],
        preferences: []
      })
      await setTimeout(50)
      expect(updates).toEqual([{ playerId: player.id, games: [game] }])
    })

    it('creates a lobby', async () => {
      lobby = await createGame(undefined, player)
      expect(lobby).toEqual({
        id: expect.any(String),
        created: expect.any(Number),
        availableSeats: 8,
        kind: undefined,
        ownerId: player.id,
        playerIds: [],
        guestIds: [player.id],
        meshes: [],
        cameras: [],
        messages: [],
        hands: [],
        preferences: []
      })
      await setTimeout(50)
      expect(updates).toEqual([{ playerId: player.id, games: [lobby] }])
    })

    it(`throws errors from descriptor's build() function`, async () => {
      vi.spyOn(console, 'error').mockImplementationOnce(() => {})
      await repositories.catalogItems.connect({
        path: join('tests', 'fixtures', 'invalid-games')
      })
      await expect(createGame('throwing', player)).rejects.toThrow(
        `internal build error`
      )
      await setTimeout(50)
      expect(updates).toHaveLength(0)
    })
  })

  describe('countOwnedGames()', () => {
    it('handles no owned games', async () => {
      await expect(await countOwnGames(player.id)).toBe(0)
    })

    it('handles unknown player', async () => {
      await expect(await countOwnGames(faker.datatype.uuid())).toBe(0)
    })

    it('counts owned games', async () => {
      const count = 4
      for (let rank = 0; rank < count; rank++) {
        games.push(await repositories.games.save({ ownerId: player.id }))
      }
      for (let rank = 0; rank < 3; rank++) {
        games.push(await repositories.games.save({ ownerId: peer.id }))
      }
      await expect(await countOwnGames(player.id)).toBe(count)
    })

    it('ignores invitations', async () => {
      const count = 3
      games.push(
        await repositories.games.save({
          ownerId: peer.id,
          playerIds: [peer.id, player.id]
        })
      )
      for (let rank = 0; rank < count; rank++) {
        games.push(
          await repositories.games.save({
            ownerId: player.id,
            playerIds: [player.id]
          })
        )
      }
      games.push(
        await repositories.games.save({
          ownerId: peer.id,
          playerIds: [player.id]
        })
      )
      await expect(await countOwnGames(player.id)).toBe(count)
    })

    it('ignores excluded game ids', async () => {
      const count = 4
      for (let rank = 0; rank < count; rank++) {
        games.push(await repositories.games.save({ ownerId: player.id }))
      }
      await expect(
        await countOwnGames(player.id, [games[0].id, games[2].id])
      ).toBe(count - 2)
    })
  })

  describe('given a created game and lobby', () => {
    beforeEach(async () => {
      game = await createGame('belote', player)
      expect(game).toMatchObject({
        availableSeats: 2,
        playerIds: [],
        guestIds: [player.id],
        preferences: []
      })
      lobby = await createGame(undefined, player)
      expect(lobby).toMatchObject({
        availableSeats: 8,
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
        await setTimeout(50)
        expect(updates).toHaveLength(0)
      })

      it('returns null on un-owned game', async () => {
        expect(await joinGame(game.id, peer2)).toBeNull()
        await setTimeout(50)
        expect(updates).toHaveLength(0)
      })

      it('automatically joins a game without parameters', async () => {
        const expectedGame = {
          ...game,
          meshes: [...game.meshes, expect.any(Object)],
          availableSeats: 1,
          guestIds: [],
          playerIds: [player.id],
          hands: [{ playerId: player.id, meshes: [] }],
          preferences: [{ playerId: player.id, color: expect.any(String) }]
        }
        expect(await joinGame(game.id, player)).toEqual(expectedGame)
        await setTimeout(50)
        expect(updates).toEqual([
          {
            playerId: player.id,
            games: expect.arrayContaining([expectedGame, lobby])
          }
        ])
      })

      it('automatically joins a lobby', async () => {
        const expectedLobby = {
          ...lobby,
          meshes: [],
          availableSeats: 7,
          guestIds: [],
          playerIds: [player.id],
          hands: [],
          preferences: []
        }
        expect(await joinGame(lobby.id, player)).toEqual(expectedLobby)
        await setTimeout(50)
        expect(updates).toEqual([
          {
            playerId: player.id,
            games: expect.arrayContaining([game, expectedLobby])
          }
        ])
      })

      it(`invokes descriptor's addPlayer() when loading game`, async () => {
        const joinedGame = await joinGame(game.id, player)
        expect(joinedGame).toEqual({
          id: expect.any(String),
          created: expect.any(Number),
          availableSeats: 1,
          kind: game.kind,
          ownerId: player.id,
          playerIds: [player.id],
          guestIds: [],
          meshes: [
            expect.objectContaining({
              texture: `/${game.kind}/textures/test.ktx2`
            }),
            expect.objectContaining({
              texture: `/${game.kind}/textures/test2.ktx2`
            })
          ],
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
        lobby = await joinGame(lobby.id, player)
        await setTimeout(50)
        updates.splice(0)
      })

      describe('joinGame()', () => {
        it('returns owned game', async () => {
          expect(await joinGame(game.id, player)).toEqual(game)
        })

        it(`adds guest id to game's player id and preference lists, and trigger list updates`, async () => {
          await await invite(game.id, [peer.id], player.id)
          await setTimeout(50)
          updates.splice(0)

          const updated = await joinGame(game.id, peer)
          expect(updated).toEqual({
            ...game,
            meshes: [...game.meshes, expect.any(Object)],
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
          expect(updates).toEqual(
            expect.arrayContaining([
              {
                playerId: player.id,
                games: expect.arrayContaining([updated, lobby])
              },
              { playerId: peer.id, games: [updated] }
            ])
          )
        })

        it('throws when the maximum number of players was reached', async () => {
          const grantedPlayer = await grantAccess(player.id, 'splendor')
          await deleteGame(game.id, grantedPlayer)
          game = await createGame('splendor', grantedPlayer) // it has 4 seats
          game = await joinGame(game.id, grantedPlayer)
          const guests = await repositories.players.save([
            { id: faker.datatype.uuid() },
            { id: faker.datatype.uuid() },
            { id: faker.datatype.uuid() },
            { id: faker.datatype.uuid() }
          ])
          for (const { id } of guests) {
            await repositories.players.makeFriends(
              grantedPlayer.id,
              id,
              repositories.FriendshipAccepted
            )
          }
          await invite(
            game.id,
            guests.map(({ id }) => id),
            grantedPlayer.id
          )

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

      describe('promoteGame()', () => {
        it('returns null on unknown game', async () => {
          expect(
            await promoteGame(faker.datatype.uuid(), 'belote', player)
          ).toBeNull()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('throws an error on unknown kind', async () => {
          const kind = faker.lorem.word()
          await expect(promoteGame(lobby.id, kind, player)).rejects.toThrow(
            `Unsupported game ${kind}`
          )
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('returns null on un-owned game', async () => {
          expect(await promoteGame(lobby.id, 'belote', peer2)).toBeNull()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('throws when the promoted lobby is already a game', async () => {
          await expect(promoteGame(game.id, 'belote', player)).rejects.toThrow(
            `is already a full game`
          )
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('promotes as full game with no parameters', async () => {
          const { kind } = game
          const expectedGame = {
            ...lobby,
            kind,
            meshes: [game.meshes[0]],
            availableSeats: 2,
            guestIds: [player.id],
            playerIds: [],
            zoomSpec: game.zoomSpec,
            preferences: []
          }
          expect(await promoteGame(lobby.id, kind, player)).toEqual(
            expectedGame
          )
          await setTimeout(50)
          expect(updates).toEqual([
            {
              playerId: player.id,
              games: expect.arrayContaining([expectedGame, game])
            }
          ])
        })

        it('promotes as full game with parameters', async () => {
          const kind = 'draughts'
          const expectedGame = {
            ...lobby,
            kind,
            meshes: [{ id: 'white-1', shape: 'token' }],
            availableSeats: 2,
            guestIds: [player.id],
            playerIds: [],
            preferences: []
          }
          expect(await promoteGame(lobby.id, kind, player)).toEqual(
            expectedGame
          )
          await setTimeout(50)
          expect(updates).toEqual([
            {
              playerId: player.id,
              games: expect.arrayContaining([expectedGame, game])
            }
          ])
        })

        it('includes players and guest from the lobby', async () => {
          await invite(lobby.id, [peer.id], player.id)
          await setTimeout(50)
          updates.splice(0)
          const { kind } = game
          const expectedGame = {
            ...lobby,
            kind,
            meshes: [game.meshes[0]],
            availableSeats: 2,
            guestIds: [player.id, peer.id],
            playerIds: [],
            zoomSpec: game.zoomSpec,
            preferences: []
          }
          expect(await promoteGame(lobby.id, kind, player)).toEqual(
            expectedGame
          )
          await setTimeout(50)
          expect(updates).toEqual(
            expect.arrayContaining([
              { playerId: peer.id, games: [expectedGame] },
              {
                playerId: player.id,
                games: expect.arrayContaining([expectedGame, game])
              }
            ])
          )
        })

        it('trims out players when they outnumber available seats', async () => {
          await invite(lobby.id, [peer.id, peer2.id], player.id)
          await joinGame(lobby.id, peer2)
          await setTimeout(50)
          updates.splice(0)
          const { kind } = game
          const expectedGame = {
            ...lobby,
            kind,
            ownerId: peer2.id,
            meshes: [game.meshes[0]],
            availableSeats: 2,
            guestIds: [player.id, peer2.id],
            playerIds: [],
            zoomSpec: game.zoomSpec,
            preferences: []
          }
          expect(await promoteGame(lobby.id, kind, peer2)).toEqual(expectedGame)
          await setTimeout(50)
          expect(updates).toEqual(
            expect.arrayContaining([
              { playerId: peer2.id, games: [expectedGame] },
              {
                playerId: player.id,
                games: expect.arrayContaining([expectedGame, game])
              }
            ])
          )
        })

        it('does not throw when promoting the last allowed lobby', async () => {
          const kind = 'belote'
          for (let rank = 0; rank < 4; rank++) {
            games.push({
              ...(await repositories.games.save({
                kind,
                ownerId: player.id,
                playerIds: [player.id]
              })),
              created: NaN,
              guestIds: []
            })
          }
          await expect(createGame(kind, player)).rejects.toThrow(
            `You own 6 games, you can not create more`
          )
          const expectedGame = {
            ...lobby,
            kind,
            ownerId: player.id,
            meshes: [game.meshes[0]],
            availableSeats: 2,
            guestIds: [player.id],
            playerIds: [],
            zoomSpec: game.zoomSpec,
            preferences: []
          }
          expect(await promoteGame(lobby.id, kind, player)).toEqual(
            expectedGame
          )
          await setTimeout(50)
          expect(updates).toEqual([
            {
              playerId: player.id,
              games: expect.arrayContaining([expectedGame, game, ...games])
            }
          ])
        })

        it('throws an error when cap reached', async () => {
          const kind = 'klondike'
          const actualCount = 10
          for (let rank = 0; rank < actualCount - 1; rank++) {
            games.push(
              await repositories.games.save({
                kind,
                ownerId: player.id,
                playerIds: [player.id]
              })
            )
          }
          await expect(promoteGame(lobby.id, 'belote', player)).rejects.toThrow(
            `You own ${actualCount} games, you can not create more`
          )
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it(`throws errors from descriptor's build() function`, async () => {
          vi.spyOn(console, 'error').mockImplementationOnce(() => {})
          await repositories.catalogItems.connect({
            path: join('tests', 'fixtures', 'invalid-games')
          })
          await expect(
            promoteGame(lobby.id, 'throwing', player)
          ).rejects.toThrow(`internal build error`)
          await setTimeout(50)
          expect(updates).toHaveLength(0)
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
            meshes: [game.meshes[0], expect.anything(), game.meshes[0]],
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
            await invite(faker.datatype.uuid(), [peer.id], player.id)
          ).toBeNull()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('returns null on un-owned game', async () => {
          expect(
            await invite(game.id, [peer.id], faker.datatype.uuid())
          ).toBeNull()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('does not invite an unknown guest id', async () => {
          vi.spyOn(repositories.players, 'getById').mockResolvedValue(null)
          expect(
            await invite(game.id, [faker.datatype.uuid()], player.id)
          ).toEqual(game)
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('does not invite an invited guest twice', async () => {
          expect(await invite(game.id, [peer.id], player.id)).toEqual({
            ...game,
            guestIds: [peer.id]
          })
          await setTimeout(50)
          updates.splice(0)

          expect(await invite(game.id, [peer.id], player.id)).toEqual({
            ...game,
            guestIds: [peer.id]
          })
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('does not invite a player twice', async () => {
          expect(await invite(game.id, [peer.id], player.id)).toEqual({
            ...game,
            guestIds: [peer.id]
          })
          const updatedGame = await joinGame(game.id, peer)
          expect(updatedGame).toMatchObject({
            availableSeats: 0,
            playerIds: [player.id, peer.id]
          })
          await setTimeout(50)
          updates.splice(0)

          expect(await invite(game.id, [peer.id], player.id)).toEqual(
            updatedGame
          )
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('does not invite a player that is not friend', async () => {
          const stranger = await repositories.players.save({
            id: faker.datatype.uuid()
          })
          expect(await invite(game.id, [stranger.id], player.id)).toEqual(game)
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('does not invite a requested friend', async () => {
          const stranger = await repositories.players.save({
            id: faker.datatype.uuid()
          })
          await repositories.players.makeFriends(
            stranger.id,
            player.id,
            repositories.FriendshipRequested
          )
          expect(await invite(game.id, [stranger.id], player.id)).toEqual(game)
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('does not invite a blocked friend', async () => {
          const stranger = await repositories.players.save({
            id: faker.datatype.uuid()
          })
          await repositories.players.makeFriends(
            player.id,
            stranger.id,
            repositories.FriendshipBlocked
          )
          expect(await invite(game.id, [stranger.id], player.id)).toEqual(game)
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it(`adds to game's guest list and trigger list updates`, async () => {
          const updated = await invite(game.id, [peer.id], player.id)
          expect(updated).toEqual({
            ...game,
            guestIds: [peer.id]
          })

          const loaded = await joinGame(game.id, player)
          expect(loaded.playerIds).toEqual([player.id])
          expect(loaded.guestIds).toEqual([peer.id])
          await setTimeout(50)
          expect(updates).toEqual(
            expect.arrayContaining([
              {
                playerId: player.id,
                games: expect.arrayContaining([updated, lobby])
              },
              { playerId: peer.id, games: [updated] }
            ])
          )
        })
      })

      describe('listGames()', () => {
        const getId = ({ id }) => id

        beforeEach(async () => {
          games.push(game)
          await invite(games[0].id, [peer.id], player.id)
          await joinGame(games[0].id, peer)

          games.push(await createGame('belote', player))
          await joinGame(games[1].id, player)

          games.push(await createGame('klondike', player))
          await joinGame(games[2].id, player)

          games.push(await createGame('belote', peer))
          await joinGame(games[3].id, peer)
          await invite(games[3].id, [player.id], peer.id)
          await joinGame(games[3].id, player)

          games.push(await createGame('belote', peer))
          await joinGame(games[4].id, player)
        })

        it('can return an empty list', async () => {
          expect(await listGames(faker.datatype.uuid())).toEqual([])
        })

        it('returns all game of a player', async () => {
          expect((await listGames(player.id)).map(getId)).toEqual(
            [games[0], games[1], games[2], games[3], lobby].map(getId).sort()
          )

          expect((await listGames(peer.id)).map(getId)).toEqual(
            [games[0], games[3], games[4]].map(getId).sort()
          )
        })
      })

      describe('deleteGame()', () => {
        it('returns null on unknown game', async () => {
          expect(await deleteGame(faker.datatype.uuid(), player)).toBeNull()
          expect(await deleteGame(faker.datatype.uuid(), peer2)).toBeNull()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('returns null on un-owned game', async () => {
          expect(
            await deleteGame(game.id, { id: faker.datatype.uuid() })
          ).toBeNull()
          expect(await joinGame(game.id, player.id)).toBeDefined()
          await setTimeout(50)
          expect(updates).toHaveLength(0)
        })

        it('returns deleted game and trigger list update', async () => {
          expect(await deleteGame(game.id, player)).toEqual(game)
          expect(await joinGame(game.id, player.id)).toBeNull()
          await setTimeout(50)
          expect(updates).toEqual([{ playerId: player.id, games: [lobby] }])
        })

        it('allows adming deleting un-owned games', async () => {
          expect(await deleteGame(game.id, peer2)).toEqual(game)
          await setTimeout(50)
          expect(updates).toEqual([{ playerId: player.id, games: [lobby] }])
        })
      })

      describe('notifyRelatedPlayers()', () => {
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
          await invite(game1.id, [peer.id], player.id)
          games.push(await joinGame(game1.id, peer))
          const game2 = await createGame('belote', peer2)
          await joinGame(game2.id, peer2)
          await invite(game2.id, [player.id], peer2.id)
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
          await invite(game1.id, [peer.id], player.id)
          games.push(await joinGame(game1.id, peer))
          const game2 = await createGame('belote', player)
          await joinGame(game2.id, player)
          await invite(game2.id, [peer.id], player.id)
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
      type: 'object',
      additionalProperties: false,
      required: ['side'],
      properties: {
        side: {
          type: 'string',
          enum: ['white', 'black'],
          metadata: {
            fr: { name: 'Couleur', white: 'Blancs', black: 'Noirs' }
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
            'must NOT have additional properties\n/side must be equal to one of the allowed values',
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
