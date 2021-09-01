import { jest } from '@jest/globals'
import faker from 'faker'
import fastify from 'fastify'
import { Subject } from 'rxjs'
import {
  openGraphQLWebSocket,
  startSubscription,
  stopSubscription,
  toGraphQLArg,
  waitOnMessage
} from '../test-utils.js'
import services from '../../src/services/index.js'
import graphQL from '../../src/plugins/graphql.js'

describe('given a started server', () => {
  let server
  let ws
  let originalServices = { ...services }
  const players = [
    { id: faker.datatype.uuid(), username: faker.name.firstName() },
    { id: faker.datatype.uuid(), username: faker.name.firstName() },
    { id: faker.datatype.uuid(), username: faker.name.firstName() }
  ]
  const gamesPath = faker.system.directoryPath()

  beforeAll(async () => {
    server = fastify({ logger: false })
    server.decorate('conf', { games: { path: gamesPath } })
    server.register(graphQL)
    await server.listen()
    ws = await openGraphQLWebSocket(server)
    // monkey patch services
    for (const method in services) {
      services[method] = jest.fn()
    }
    services.gameListsUpdate = new Subject()
  })

  beforeEach(jest.resetAllMocks)

  afterAll(async () => {
    Object.assign(services, originalServices)
    try {
      ws?.close()
    } catch {
      // ignore closure errors
    }
    await server?.close()
  })

  describe('Games GraphQL resolver', () => {
    it('loads game details and resolves player objects', async () => {
      const playerId = players[0].id
      const game = {
        id: faker.datatype.uuid(),
        kind: 'tarot',
        created: faker.date.past().getTime(),
        playerIds: players.map(({ id }) => id)
      }
      services.getPlayerById.mockResolvedValueOnce(players[0])
      services.getPlayersById.mockResolvedValueOnce(players)
      services.loadGame.mockResolvedValueOnce(game)

      const response = await server.inject({
        method: 'POST',
        url: 'graphql',
        headers: { authorization: `Bearer ${playerId}` },
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
      expect(services.getPlayerById).toHaveBeenCalledWith(playerId)
      expect(services.getPlayerById).toHaveBeenCalledTimes(1)
      expect(services.loadGame).toHaveBeenCalledWith(game.id, playerId)
      expect(services.loadGame).toHaveBeenCalledTimes(1)
      expect(services.getPlayersById).toHaveBeenCalledWith(game.playerIds)
      expect(services.getPlayersById).toHaveBeenCalledTimes(1)
    })

    it('creates a new game and resolves player objects', async () => {
      const playerId = players[0].id
      const kind = faker.random.arrayElement(['coinche', 'tarot', 'belote'])
      const game = {
        id: faker.datatype.uuid(),
        kind,
        created: Date.now(),
        playerIds: [playerId]
      }
      services.getPlayerById.mockResolvedValueOnce(players[0])
      services.getPlayersById.mockResolvedValueOnce([players[0]])
      services.createGame.mockResolvedValueOnce(game)

      const response = await server.inject({
        method: 'POST',
        url: 'graphql',
        headers: { authorization: `Bearer ${playerId}` },
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
      expect(services.getPlayerById).toHaveBeenCalledWith(playerId)
      expect(services.getPlayerById).toHaveBeenCalledTimes(1)
      expect(services.createGame).toHaveBeenCalledWith(
        gamesPath,
        kind,
        playerId
      )
      expect(services.createGame).toHaveBeenCalledTimes(1)
      expect(services.getPlayersById).toHaveBeenCalledWith(game.playerIds)
      expect(services.getPlayersById).toHaveBeenCalledTimes(1)
    })

    it('saves an existing game and resolves player objects', async () => {
      const playerId = players[0].id
      const kind = faker.random.arrayElement(['coinche', 'tarot', 'belote'])
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
      services.getPlayerById.mockResolvedValueOnce(players[0])
      services.getPlayersById.mockResolvedValueOnce(players)
      services.saveGame.mockResolvedValueOnce(game)

      const response = await server.inject({
        method: 'POST',
        url: 'graphql',
        headers: { authorization: `Bearer ${playerId}` },
        payload: {
          query: `mutation {
  saveGame(game: ${toGraphQLArg({ id: game.id, messages })}) {
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
        data: { saveGame: { ...game, playerIds: undefined, players } }
      })
      expect(response.statusCode).toEqual(200)
      expect(services.getPlayerById).toHaveBeenCalledWith(playerId)
      expect(services.getPlayerById).toHaveBeenCalledTimes(1)
      expect(services.saveGame).toHaveBeenCalledWith(
        { id: game.id, messages },
        playerId
      )
      expect(services.saveGame).toHaveBeenCalledTimes(1)
      expect(services.getPlayersById).toHaveBeenCalledWith(game.playerIds)
      expect(services.getPlayersById).toHaveBeenCalledTimes(1)
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
      services.getPlayerById.mockResolvedValueOnce(players[0])
      services.getPlayersById.mockResolvedValueOnce(players.slice(0, 2))
      services.invite.mockResolvedValueOnce(game)

      const response = await server.inject({
        method: 'POST',
        url: 'graphql',
        headers: { authorization: `Bearer ${playerId}` },
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
      expect(services.getPlayerById).toHaveBeenCalledWith(playerId)
      expect(services.getPlayerById).toHaveBeenCalledTimes(1)
      expect(services.invite).toHaveBeenCalledWith(game.id, peerId, playerId)
      expect(services.invite).toHaveBeenCalledTimes(1)
      expect(services.getPlayersById).toHaveBeenCalledWith(game.playerIds)
      expect(services.getPlayersById).toHaveBeenCalledTimes(1)
    })

    it('deletes an existing game and resolves player objects', async () => {
      const playerId = players[0].id
      const game = {
        id: faker.datatype.uuid(),
        kind: 'coinche',
        created: faker.date.past().getTime(),
        playerIds: players.map(({ id }) => id)
      }
      services.getPlayerById.mockResolvedValueOnce(players[0])
      services.getPlayersById.mockResolvedValueOnce(players)
      services.deleteGame.mockResolvedValueOnce(game)

      const response = await server.inject({
        method: 'POST',
        url: 'graphql',
        headers: { authorization: `Bearer ${playerId}` },
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
      expect(services.getPlayerById).toHaveBeenCalledWith(playerId)
      expect(services.getPlayerById).toHaveBeenCalledTimes(1)
      expect(services.deleteGame).toHaveBeenCalledWith(game.id, playerId)
      expect(services.deleteGame).toHaveBeenCalledTimes(1)
      expect(services.getPlayersById).toHaveBeenCalledWith(game.playerIds)
      expect(services.getPlayersById).toHaveBeenCalledTimes(1)
    })

    it('lists player games on subscription', async () => {
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
      services.getPlayerById.mockResolvedValueOnce(players[0])
      services.getPlayersById.mockImplementation(async ids =>
        players.filter(({ id }) => ids.includes(id))
      )
      services.listGames.mockResolvedValueOnce(games)
      const start = startSubscription(
        ws,
        'subscription { listGames { id created players { id username } } }',
        playerId
      )
      const data = waitOnMessage(ws, data => data.type === 'data')
      await start
      expect(await data).toEqual(
        expect.objectContaining({
          payload: {
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
          }
        })
      )
      expect(services.getPlayerById).toHaveBeenCalledWith(playerId)
      expect(services.getPlayerById).toHaveBeenCalledTimes(1)
      expect(services.listGames).toHaveBeenCalledWith(playerId)
      expect(services.listGames).toHaveBeenCalledTimes(1)
      expect(services.getPlayersById).toHaveBeenNthCalledWith(
        1,
        games[0].playerIds
      )
      expect(services.getPlayersById).toHaveBeenNthCalledWith(
        2,
        games[1].playerIds
      )
      expect(services.getPlayersById).toHaveBeenNthCalledWith(
        3,
        games[2].playerIds
      )
      expect(services.getPlayersById).toHaveBeenCalledTimes(3)
      await stopSubscription(ws)
    })

    it('ignores game list updates for other players', async () => {
      const playerId = players[0].id
      const game = {
        id: faker.datatype.uuid(),
        created: Date.now(),
        playerIds: [playerId]
      }
      services.getPlayerById.mockResolvedValueOnce(players[0])
      services.getPlayersById.mockImplementation(async ids =>
        players.filter(({ id }) => ids.includes(id))
      )
      services.listGames.mockResolvedValueOnce([])
      const start = startSubscription(
        ws,
        'subscription { listGames { id created players { id username } } }',
        playerId
      )
      const data = waitOnMessage(ws, data => data.type === 'data')
      await start
      expect(await data).toEqual(
        expect.objectContaining({ payload: { data: { listGames: [] } } })
      )

      const nextData = waitOnMessage(ws, data => data.type === 'data')
      services.gameListsUpdate.next({ playerId: players[1].id, games: [] })

      services.gameListsUpdate.next({ playerId, games: [game] })

      expect(await nextData).toEqual(
        expect.objectContaining({
          payload: {
            data: {
              listGames: [
                { ...game, playerIds: undefined, players: [players[0]] }
              ]
            }
          }
        })
      )

      expect(services.getPlayerById).toHaveBeenCalledWith(playerId)
      expect(services.getPlayerById).toHaveBeenCalledTimes(1)
      expect(services.listGames).toHaveBeenCalledWith(playerId)
      expect(services.listGames).toHaveBeenCalledTimes(1)
      expect(services.getPlayersById).toHaveBeenCalledWith(game.playerIds)
      expect(services.getPlayersById).toHaveBeenCalledTimes(1)
      await stopSubscription(ws)
    })
  })
})
