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
import services from '../../src/services/index.js'
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
  let server
  let ws
  let restoreServices
  const players = [
    { id: faker.datatype.uuid(), username: faker.name.firstName() },
    { id: faker.datatype.uuid(), username: faker.name.firstName() },
    { id: faker.datatype.uuid(), username: faker.name.firstName() }
  ]
  const configuration = {
    auth: { jwt: { key: faker.datatype.uuid() } }
  }

  beforeAll(async () => {
    server = fastify({ logger: false })
    server.decorate('conf', configuration)
    server.register(graphQL)
    await server.listen()
    ws = await openGraphQLWebSocket(server)
    restoreServices = mockMethods(services)
    services.gameListsUpdate = new Subject()
  })

  beforeEach(vi.resetAllMocks)

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
    describe('loadGame query', () => {
      it('fails on unauthenticated requests', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `{ loadGame(gameId: "${faker.datatype.uuid()}") { id } }`
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).not.toHaveBeenCalled()
        expect(await response.json()).toMatchObject({
          data: { loadGame: null },
          errors: [{ message: 'Unauthorized' }]
        })
      })

      it('loads game details and resolves player objects', async () => {
        const playerId = players[0].id
        const game = {
          id: faker.datatype.uuid(),
          kind: 'tarot',
          created: faker.date.past().getTime(),
          playerIds: players.map(({ id }) => id)
        }
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
          .mockResolvedValueOnce(players)
        services.loadGame.mockResolvedValueOnce(game)

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
            query: `{
  loadGame(gameId: "${game.id}") {
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
          data: { loadGame: { ...game, playerIds: undefined, players } }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          game.playerIds
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
        expect(services.loadGame).toHaveBeenCalledWith(game.id, playerId)
        expect(services.loadGame).toHaveBeenCalledTimes(1)
      })
    })

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
        const games = [
          {
            id: faker.datatype.uuid(),
            created: faker.date.past().getTime(),
            playerIds: [playerId]
          },
          {
            id: faker.datatype.uuid(),
            created: faker.date.past().getTime(),
            playerIds: [playerId, players[1].id]
          },
          {
            id: faker.datatype.uuid(),
            created: faker.date.past().getTime(),
            playerIds: [playerId, players[2].id]
          }
        ]
        services.getPlayerById.mockImplementation(async ids =>
          Array.isArray(ids)
            ? players.filter(({ id }) => ids.includes(id))
            : players.find(({ id }) => id === ids)
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
            query: `{ listGames { id created players { id username } } }`
          }
        })

        expect(response.json()).toEqual({
          data: {
            listGames: [
              { ...games[0], playerIds: undefined, players: [players[0]] },
              {
                ...games[1],
                playerIds: undefined,
                players: [players[0], players[1]]
              },
              {
                ...games[2],
                playerIds: undefined,
                players: [players[0], players[2]]
              }
            ]
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.listGames).toHaveBeenCalledWith(playerId)
        expect(services.listGames).toHaveBeenCalledTimes(1)
        expect(services.getPlayerById).toHaveBeenCalledWith(playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          games[0].playerIds
        )
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          3,
          games[1].playerIds
        )
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
        const game = {
          id: faker.datatype.uuid(),
          kind,
          created: Date.now(),
          playerIds: [playerId]
        }
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
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
            createGame: { ...game, playerIds: undefined, players: [players[0]] }
          }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          game.playerIds
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
        expect(services.createGame).toHaveBeenCalledWith(kind, playerId)
        expect(services.createGame).toHaveBeenCalledTimes(1)
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
        const game = {
          id: faker.datatype.uuid(),
          kind,
          created: faker.date.past().getTime(),
          playerIds: players.map(({ id }) => id),
          messages
        }
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
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
            saveGame: { ...game, playerIds: undefined, players }
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
        expect(services.saveGame).toHaveBeenCalledTimes(1)
      })
    })

    describe('invite mutation', () => {
      it('fails on unauthenticated requests', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { invite(gameId: "1234", playerId: "abcd") { id } }`
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
        const peerId = players[1].id
        const game = {
          id: faker.datatype.uuid(),
          kind: 'belote',
          created: faker.date.past().getTime(),
          playerIds: [playerId, peerId]
        }
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
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
  invite(gameId: "${game.id}", playerId: "${peerId}") {
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
        expect(services.invite).toHaveBeenCalledWith(game.id, peerId, playerId)
        expect(services.invite).toHaveBeenCalledTimes(1)
      })
    })

    describe('deleteGame mutation', () => {
      it('fails on unauthenticated requests', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { deleteGame(gameId: "${faker.datatype.uuid()}") { id } }`
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
        const game = {
          id: faker.datatype.uuid(),
          kind: 'coinche',
          created: faker.date.past().getTime(),
          playerIds: players.map(({ id }) => id)
        }
        services.getPlayerById
          .mockResolvedValueOnce(players[0])
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
          data: { deleteGame: { ...game, playerIds: undefined, players } }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, playerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(
          2,
          game.playerIds
        )
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
        expect(services.deleteGame).toHaveBeenCalledWith(game.id, playerId)
        expect(services.deleteGame).toHaveBeenCalledTimes(1)
      })
    })

    describe('receiveGameListUpdates subscription', () => {
      const playerId = players[0].id
      const game = {
        id: faker.datatype.uuid(),
        created: Date.now(),
        playerIds: [playerId]
      }

      beforeEach(() => {
        services.getPlayerById.mockImplementation(async ids =>
          Array.isArray(ids)
            ? players.filter(({ id }) => ids.includes(id))
            : players.find(({ id }) => id === ids)
        )
      })

      afterEach(() => stopSubscription(ws))

      it('senfs update for current player', async () => {
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
                  { ...game, playerIds: undefined, players: [players[0]] }
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
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
      })
    })

    describe('receiveGameUpdates subscription', () => {
      const playerId = players[0].id
      const games = [
        {
          id: faker.datatype.uuid(),
          created: faker.date.past().getTime(),
          playerIds: [playerId]
        },
        {
          id: faker.datatype.uuid(),
          created: faker.date.past().getTime(),
          playerIds: [playerId, players[1].id]
        },
        {
          id: faker.datatype.uuid(),
          created: faker.date.past().getTime(),
          playerIds: [players[1].id, players[2].id]
        }
      ]

      beforeEach(() => {
        services.getPlayerById.mockImplementation(async ids =>
          Array.isArray(ids)
            ? players.filter(({ id }) => ids.includes(id))
            : players.find(({ id }) => id === ids)
        )
      })

      afterEach(() => stopSubscription(ws))

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
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
      })
    })
  })
})
