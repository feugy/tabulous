// @ts-check
/**
 * @typedef {import('fastify').FastifyInstance} FastifyInstance
 * @typedef {import('../../src/services/players').Player} Player
 * @typedef {import('../../src/services/games').GameData} GameData
 * @typedef {import('../../src/services/games').GameListUpdate} GameListUpdate
 * @typedef {import('../../src/services/games').GameParameters} GameParameters
 */

import { faker } from '@faker-js/faker'
import fastify from 'fastify'
import { Subject } from 'rxjs'
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

import graphQL from '../../src/plugins/graphql.js'
import realServices from '../../src/services/index.js'
import { makeLogger } from '../../src/utils/index.js'
import {
  mockMethods,
  openGraphQLWebSocket,
  signToken,
  startSubscription,
  stopSubscription,
  toGraphQLArg,
  waitOnMessage
} from '../test-utils.js'

describe('given a started server', () => {
  /** @type {FastifyInstance} */
  let server
  /** @type {import('ws')} */
  let ws
  /** @type {ReturnType<typeof mockMethods>} */
  let restoreServices
  const services =
    /** @type {import('../test-utils').MockedMethods<typeof realServices> & {gameListsUpdate: Subject<GameListUpdate>}} */ (
      realServices
    )
  vi.spyOn(makeLogger('graphql-plugin'), 'warn').mockImplementation(() => {})
  const players = /** @type {Player[]} */ ([
    { id: 'player-0', username: faker.person.firstName() },
    { id: 'player-1', username: faker.person.firstName() },
    { id: 'player-2', username: faker.person.firstName() }
  ])
  const guests = /** @type {Player[]} */ ([
    { id: 'guest-0', username: faker.person.firstName() },
    { id: 'guest-1', username: faker.person.firstName() },
    { id: 'guest-2', username: faker.person.firstName() }
  ])
  const configuration = {
    auth: { jwt: { key: faker.string.uuid() } }
  }

  beforeAll(async () => {
    server = fastify({ logger: false })
    server.decorate('conf', configuration)
    server.register(graphQL)
    await server.listen()
    ws = await openGraphQLWebSocket(server)
    restoreServices = mockMethods(services)
    /** @type {Subject<GameListUpdate>} */
    services.gameListsUpdate = new Subject()
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterAll(async () => {
    restoreServices()
    try {
      ws?.close()
    } catch {
      // ignore closure errors
    }
    await server?.close()
  })

  describe('Games GraphQL resolver', () => {
    describe('listGames query', () => {
      it('fails on unauthenticated requests', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `{ listGames { id } }`
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).not.toHaveBeenCalled()
        expect(await response.json()).toMatchObject({
          data: { listGames: null },
          errors: [{ message: 'Unauthorized' }]
        })
      })

      it('returns current games', async () => {
        const playerId = players[0].id
        const games = /** @type {GameData[]} */ ([
          {
            id: faker.string.uuid(),
            created: faker.date.past().getTime(),
            ownerId: playerId,
            playerIds: [playerId],
            guestIds: []
          },
          {
            id: faker.string.uuid(),
            created: faker.date.past().getTime(),
            ownerId: playerId,
            playerIds: [players[1].id],
            guestIds: [playerId]
          },
          {
            id: faker.string.uuid(),
            created: faker.date.past().getTime(),
            ownerId: playerId,
            playerIds: [playerId, players[2].id],
            guestIds: []
          }
        ])
        services.getPlayerById.mockImplementation(async ids =>
          // @ts-expect-error: Mocked inference does not support overloads
          Array.isArray(ids)
            ? players.filter(({ id }) => ids.includes(id))
            : players.find(({ id }) => id === ids) ?? null
        )
        services.listGames.mockResolvedValueOnce(games)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              playerId,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `{ listGames { id created players { id username isOwner isGuest } } }`
          }
        })

        expect(response.json()).toEqual({
          data: {
            listGames: [
              {
                ...games[0],
                playerIds: undefined,
                guestIds: undefined,
                ownerId: undefined,
                players: [{ ...players[0], isGuest: false, isOwner: true }]
              },
              {
                ...games[1],
                playerIds: undefined,
                guestIds: undefined,
                ownerId: undefined,
                players: [
                  { ...players[0], isGuest: true, isOwner: true },
                  { ...players[1], isGuest: false, isOwner: false }
                ]
              },
              {
                ...games[2],
                playerIds: undefined,
                guestIds: undefined,
                ownerId: undefined,
                players: [
                  { ...players[0], isGuest: false, isOwner: true },
                  { ...players[2], isGuest: false, isOwner: false }
                ]
              }
            ]
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).toHaveBeenCalledWith(playerId)
        expect(services.listGames).toHaveBeenCalledOnce()
        expect(services.getPlayerById).toHaveBeenCalledWith(playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          games[0].playerIds
        )
        expect(services.getPlayerById).toHaveBeenNthCalledWith(3, [
          ...games[1].playerIds,
          ...games[1].guestIds
        ])
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          4,
          games[2].playerIds
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(4)
      })
    })

    describe('createGame mutation', () => {
      it('fails on unauthenticated requests', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { createGame(kind: "draughts") { id } }`
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).not.toHaveBeenCalled()
        expect(await response.json()).toMatchObject({
          data: { createGame: null },
          errors: [{ message: 'Unauthorized' }]
        })
      })

      it('creates a new game and resolves player objects', async () => {
        const playerId = players[0].id
        const kind = faker.helpers.arrayElement(['coinche', 'tarot', 'belote'])
        // @ts-expect-error: missing properties
        const game = /** @type {GameData} */ ({
          id: faker.string.uuid(),
          kind,
          created: Date.now(),
          playerIds: [playerId],
          guestIds: []
        })
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
          // @ts-expect-error: Mocked inference does not support overloads
          .mockResolvedValueOnce([players[0]])
        services.createGame.mockResolvedValueOnce(game)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              playerId,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation {
  createGame(kind: "${kind}") {
    id
    kind
    created
    players {
      id
      username
    }
  }
}`
          }
        })

        expect(response.json()).toEqual({
          data: {
            createGame: {
              ...game,
              guestIds: undefined,
              playerIds: undefined,
              players: [players[0]]
            }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          game.playerIds
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
        expect(services.createGame).toHaveBeenCalledWith(kind, players[0])
        expect(services.createGame).toHaveBeenCalledOnce()
      })
    })

    describe('promoteGame mutation', () => {
      it('fails on unauthenticated requests', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { promoteGame(gameId: "123", kind: "draughts") { ...on Game { id } } }`
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).not.toHaveBeenCalled()
        expect(await response.json()).toMatchObject({
          data: { promoteGame: null },
          errors: [{ message: 'Unauthorized' }]
        })
      })

      it('promotes an existing lobby and resolves player objects', async () => {
        const playerId = players[0].id
        const kind = faker.helpers.arrayElement(['coinche', 'tarot', 'belote'])
        // @ts-expect-error: missing properties
        const game = /** @type {GameData} */ ({
          id: faker.string.uuid(),
          kind,
          created: Date.now(),
          playerIds: [],
          guestIds: [playerId]
        })
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
          // @ts-expect-error: Mocked inference does not support overloads
          .mockResolvedValueOnce([players[0]])
        services.promoteGame.mockResolvedValueOnce(game)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              playerId,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation {
  promoteGame(gameId: "${game.id}", kind: "${kind}") {
    ...on Game {
      id
      kind
      created
      players { id username }
    }
  }
}`
          }
        })

        expect(response.json()).toEqual({
          data: {
            promoteGame: {
              ...game,
              guestIds: undefined,
              playerIds: undefined,
              players: [players[0]]
            }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(2, game.guestIds)
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
        expect(services.promoteGame).toHaveBeenCalledWith(
          game.id,
          kind,
          players[0]
        )
        expect(services.promoteGame).toHaveBeenCalledOnce()
      })
    })

    describe('joinGame mutation', () => {
      it('fails on unauthenticated requests', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { joinGame(gameId: "${faker.string.uuid()}") { ... on Game { id } ... on GameParameters { id } } }`
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).not.toHaveBeenCalled()
        expect(await response.json()).toMatchObject({
          data: { joinGame: null },
          errors: [{ message: 'Unauthorized' }]
        })
      })

      it('loads game details and resolves player objects', async () => {
        const [player] = players
        const game = /** @type {GameData} */ ({
          id: faker.string.uuid(),
          kind: 'tarot',
          created: faker.date.past().getTime(),
          ownerId: player.id,
          playerIds: players.map(({ id }) => id),
          guestIds: guests.map(({ id }) => id)
        })
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
          // @ts-expect-error: Mocked inference does not support overloads
          .mockResolvedValueOnce(players.concat(guests))
        services.joinGame.mockResolvedValueOnce(game)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation {
  joinGame(gameId: "${game.id}") { 
    ... on Game { 
      id
      kind
      created
      players {
        id
        username
        isGuest
        isOwner
      }
    } ... on GameParameters { 
      id 
    } 
  }
}`
          }
        })

        expect(response.json()).toEqual({
          data: {
            joinGame: {
              ...game,
              ownerId: undefined,
              playerIds: undefined,
              guestIds: undefined,
              players: [...players, ...guests].map(obj => ({
                ...obj,
                isGuest: guests.includes(obj),
                isOwner: obj === player
              }))
            }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          game.playerIds.concat(game.guestIds)
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
        expect(services.joinGame).toHaveBeenCalledWith(game.id, player, null)
        expect(services.joinGame).toHaveBeenCalledOnce()
      })

      it('loads game parameters', async () => {
        const [player] = players
        const gameParameters = /** @type {GameParameters} */ ({
          id: faker.string.uuid(),
          schema: {},
          ownerId: player.id,
          playerIds: players.map(({ id }) => id),
          guestIds: guests.map(({ id }) => id)
        })
        const value = faker.lorem.words()
        services.getPlayerById
          .mockResolvedValueOnce(player)
          // @ts-expect-error: Mocked inference does not support overloads
          .mockResolvedValueOnce(players.concat(guests))
        services.joinGame.mockResolvedValueOnce(gameParameters)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { joinGame(gameId: "${gameParameters.id}", parameters: "{\\"foo\\":\\"${value}\\"}") { 
              ... on Game { 
                id 
                kind 
              } 
              ... on GameParameters { 
                id 
                players {
                  id
                  username
                  isGuest
                  isOwner
                }
              } 
            } 
          }`
          }
        })

        expect(response.json()).toEqual({
          data: {
            joinGame: {
              id: gameParameters.id,
              playerIds: undefined,
              guestIds: undefined,
              players: [...players, ...guests].map(obj => ({
                ...obj,
                isGuest: guests.includes(obj),
                isOwner: obj === player
              }))
            }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          gameParameters.playerIds.concat(gameParameters.guestIds)
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
        expect(services.joinGame).toHaveBeenCalledWith(
          gameParameters.id,
          player,
          { foo: value }
        )
        expect(services.joinGame).toHaveBeenCalledOnce()
      })

      it('rejects broken parameters', async () => {
        const [player] = players
        services.getPlayerById.mockResolvedValueOnce(player)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              player.id,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation { joinGame(gameId: "${faker.string.uuid()}", parameters: "{\\"broken\\": true" ) { ... on Game { id } ... on GameParameters { id } } }`
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).not.toHaveBeenCalled()
        expect(await response.json()).toMatchObject({
          data: { joinGame: null },
          errors: [
            {
              message: `Failed to parse provided parameters: Expected ',' or '}' after property value in JSON at position 15`
            }
          ]
        })
      })
    })

    describe('saveGame mutation', () => {
      it('fails on unauthenticated requests', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { saveGame(game: { id: "1" }) { id } }`
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).not.toHaveBeenCalled()
        expect(await response.json()).toMatchObject({
          data: { saveGame: null },
          errors: [{ message: 'Unauthorized' }]
        })
      })

      it('saves an existing game and resolves player objects', async () => {
        const playerId = players[0].id
        const kind = faker.helpers.arrayElement(['coinche', 'tarot', 'belote'])
        const messages = [
          {
            playerId,
            text: faker.lorem.words(),
            time: faker.date.past().getTime()
          }
        ]
        // @ts-expect-error: missing properties
        const game = /** @type {GameData} */ ({
          id: faker.string.uuid(),
          kind,
          created: faker.date.past().getTime(),
          playerIds: players.map(({ id }) => id),
          guestIds: [],
          messages
        })
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
          // @ts-expect-error: Mocked inference does not support overloads
          .mockResolvedValueOnce(players)
        services.saveGame.mockResolvedValueOnce(game)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              playerId,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation {
  saveGame(game: ${toGraphQLArg({ id: game.id, messages, meshes: [] })}) {
    id
    kind
    created
    players {
      id
      username
    }
    messages {
      playerId
      text
      time
    }
  }
}`
          }
        })

        expect(response.json()).toEqual({
          data: {
            saveGame: {
              ...game,
              playerIds: undefined,
              guestIds: undefined,
              players
            }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          game.playerIds
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
        expect(services.saveGame).toHaveBeenCalledWith(
          { id: game.id, messages, meshes: [] },
          playerId
        )
        expect(services.saveGame).toHaveBeenCalledOnce()
      })
    })

    describe('invite mutation', () => {
      it('fails on unauthenticated requests', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { invite(gameId: "1234", playerIds: ["abcd"]) { id } }`
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).not.toHaveBeenCalled()
        expect(await response.json()).toMatchObject({
          data: { invite: null },
          errors: [{ message: 'Unauthorized' }]
        })
      })

      it('invites another player to an existing game and resolves player objects', async () => {
        const playerId = players[0].id
        const peerIds = players.slice(1, 3).map(({ id }) => id)
        // @ts-expect-error: missing properties
        const game = /** @type {GameData} */ ({
          id: faker.string.uuid(),
          kind: 'belote',
          created: faker.date.past().getTime(),
          playerIds: [playerId, ...peerIds],
          guestIds: []
        })
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
          // @ts-expect-error: Mocked inference does not support overloads
          .mockResolvedValueOnce(players.slice(0, 2))
        services.invite.mockResolvedValueOnce(game)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              playerId,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation {
  invite(gameId: "${game.id}", playerIds: ${JSON.stringify(peerIds)}) {
    id
    kind
    created
    players {
      id
      username
    }
  }
}`
          }
        })

        expect(response.json()).toEqual({
          data: {
            invite: {
              ...game,
              playerIds: undefined,
              guestIds: undefined,
              players: players.slice(0, 2)
            }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          game.playerIds
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
        expect(services.invite).toHaveBeenCalledWith(game.id, peerIds, playerId)
        expect(services.invite).toHaveBeenCalledOnce()
      })
    })

    describe('kick mutation', () => {
      it('fails on unauthenticated requests', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { kick(gameId: "1234", playerId: "abcd") { id } }`
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).not.toHaveBeenCalled()
        expect(await response.json()).toMatchObject({
          data: { kick: null },
          errors: [{ message: 'Unauthorized' }]
        })
      })

      it('kicks a player from an existing game and resolves player objects', async () => {
        const playerId = players[0].id
        const kickedId = players[1].id
        // @ts-expect-error: missing properties
        const game = /** @type {GameData} */ ({
          id: faker.string.uuid(),
          kind: 'belote',
          created: faker.date.past().getTime(),
          playerIds: [playerId],
          guestIds: []
        })
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
          // @ts-expect-error: Mocked inference does not support overloads
          .mockResolvedValueOnce(players.slice(0, 1))
        services.kick.mockResolvedValueOnce(game)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              playerId,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation {
  kick(gameId: "${game.id}", playerId: "${kickedId}") {
    id
    kind
    created
    players {
      id
      username
    }
  }
}`
          }
        })

        expect(response.json()).toEqual({
          data: {
            kick: {
              ...game,
              playerIds: undefined,
              guestIds: undefined,
              players: players.slice(0, 1)
            }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          game.playerIds
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
        expect(services.kick).toHaveBeenCalledWith(game.id, kickedId, playerId)
        expect(services.kick).toHaveBeenCalledOnce()
      })
    })

    describe('deleteGame mutation', () => {
      it('fails on unauthenticated requests', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { deleteGame(gameId: "${faker.string.uuid()}") { id } }`
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).not.toHaveBeenCalled()
        expect(await response.json()).toMatchObject({
          data: { deleteGame: null },
          errors: [{ message: 'Unauthorized' }]
        })
      })

      it('deletes an existing game and resolves player objects', async () => {
        const playerId = players[0].id
        // @ts-expect-error: missing properties
        const game = /** @type {GameData} */ ({
          id: faker.string.uuid(),
          kind: 'coinche',
          created: faker.date.past().getTime(),
          playerIds: players.map(({ id }) => id),
          guestIds: []
        })
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
          // @ts-expect-error: Mocked inference does not support overloads
          .mockResolvedValueOnce(players)
        services.deleteGame.mockResolvedValueOnce(game)

        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: {
            authorization: `Bearer ${signToken(
              playerId,
              configuration.auth.jwt.key
            )}`
          },
          payload: {
            query: `mutation {
  deleteGame(gameId: "${game.id}") {
    id
    kind
    created
    players {
      id
      username
    }
  }
}`
          }
        })

        expect(response.json()).toEqual({
          data: {
            deleteGame: {
              ...game,
              playerIds: undefined,
              guestIds: undefined,
              players
            }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          game.playerIds
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
        expect(services.deleteGame).toHaveBeenCalledWith(game.id, players[0])
        expect(services.deleteGame).toHaveBeenCalledOnce()
      })
    })

    describe('receiveGameListUpdates subscription', () => {
      const playerId = players[0].id
      // @ts-expect-error: missing properties
      const game = /** @type {Game} */ ({
        id: faker.string.uuid(),
        created: Date.now(),
        playerIds: [playerId],
        guestIds: []
      })

      beforeEach(() => {
        services.getPlayerById.mockImplementation(async ids =>
          // @ts-expect-error: Mocked inference does not support overloads
          Array.isArray(ids)
            ? players.filter(({ id }) => ids.includes(id))
            : players.find(({ id }) => id === ids) ?? null
        )
      })

      afterEach(async () => {
        await stopSubscription(ws)
      })

      it('sends update for current player', async () => {
        await startSubscription(
          ws,
          'subscription { receiveGameListUpdates { id created players { id username } } }',
          signToken(playerId, configuration.auth.jwt.key)
        )
        const data = waitOnMessage(ws, data => data.type === 'data')
        services.gameListsUpdate.next({ playerId, games: [game] })

        expect(await data).toEqual(
          expect.objectContaining({
            payload: {
              data: {
                receiveGameListUpdates: [
                  {
                    ...game,
                    playerIds: undefined,
                    guestIds: undefined,
                    players: [players[0]]
                  }
                ]
              }
            }
          })
        )
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          game.playerIds
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
      })

      it('ignores game list updates for other players', async () => {
        await startSubscription(
          ws,
          'subscription { receiveGameListUpdates { id created players { id username } } }',
          signToken(playerId, configuration.auth.jwt.key)
        )
        const data = waitOnMessage(ws, data => data.type === 'data')
        services.gameListsUpdate.next({ playerId: players[1].id, games: [] })
        await expect(
          Promise.race([
            data,
            new Promise((resolve, reject) =>
              setTimeout(reject, 500, new Error('timeout'))
            )
          ])
        ).rejects.toThrow('timeout')
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, playerId)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
      })
    })

    describe('receiveGameUpdates subscription', () => {
      const playerId = players[0].id
      // @ts-expect-error: missing properties.
      const games = /** @type {Game[]} */ ([
        {
          id: faker.string.uuid(),
          created: faker.date.past().getTime(),
          playerIds: [playerId],
          guestIds: []
        },
        {
          id: faker.string.uuid(),
          created: faker.date.past().getTime(),
          playerIds: [playerId, players[1].id],
          guestIds: []
        },
        {
          id: faker.string.uuid(),
          created: faker.date.past().getTime(),
          playerIds: [players[1].id, players[2].id],
          guestIds: []
        }
      ])

      beforeEach(() => {
        services.getPlayerById.mockImplementation(async ids =>
          // @ts-expect-error: Mocked inference does not support overloads
          Array.isArray(ids)
            ? players.filter(({ id }) => ids.includes(id))
            : players.find(({ id }) => id === ids) ?? null
        )
      })

      afterEach(async () => {
        await stopSubscription(ws)
      })

      it('sends updates on game change', async () => {
        await startSubscription(
          ws,
          `subscription { 
            receiveGameUpdates(gameId: "${games[0].id}") { 
              id
              created
              players { id username }
            } 
          }`,
          signToken(playerId, configuration.auth.jwt.key)
        )
        const data = waitOnMessage(ws, data => data.type === 'data')
        services.gameListsUpdate.next({ playerId, games: games.slice(0, 2) })
        expect(await data).toEqual(
          expect.objectContaining({
            payload: {
              data: {
                receiveGameUpdates: {
                  ...games[0],
                  playerIds: undefined,
                  guestIds: undefined,
                  players: players.slice(0, 1)
                }
              }
            }
          })
        )
        expect(services.getPlayerById).toHaveBeenCalledWith(playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(2, [playerId])
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
      })

      it('ignores updates from other players', async () => {
        await startSubscription(
          ws,
          `subscription { 
            receiveGameUpdates(gameId: "${games[0].id}") { 
              id 
              created
              players { id username }
            } 
          }`,
          signToken(playerId, configuration.auth.jwt.key)
        )
        const data = waitOnMessage(ws, data => data.type === 'data')
        services.gameListsUpdate.next({
          playerId: players[1].id,
          games: games.slice(1)
        })
        await expect(
          Promise.race([
            data,
            new Promise((resolve, reject) =>
              setTimeout(reject, 500, new Error('timeout'))
            )
          ])
        ).rejects.toThrow('timeout')
        expect(services.getPlayerById).toHaveBeenCalledWith(playerId)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
      })
    })
  })
})
