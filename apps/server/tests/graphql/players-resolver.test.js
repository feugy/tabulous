import { faker } from '@faker-js/faker'
import { jest } from '@jest/globals'
import fastify from 'fastify'
import services from '../../src/services/index.js'
import graphQL from '../../src/plugins/graphql.js'
import { mockMethods } from '../test-utils.js'

describe('given a started server', () => {
  let server
  let restoreServices
  const configuration = {
    turn: { secret: faker.lorem.words() }
  }

  beforeAll(async () => {
    server = fastify({ logger: false })
    server.decorate('conf', configuration)
    server.register(graphQL)
    await server.listen()
    restoreServices = mockMethods(services)
  })

  beforeEach(jest.resetAllMocks)

  afterAll(async () => {
    restoreServices()
    await server?.close()
  })

  describe('Player GraphQL resolver', () => {
    describe('logIn mutation', () => {
      it('logs user without authentication', async () => {
        const username = faker.name.firstName()
        const password = faker.internet.password()
        const turnCredentials = {
          username: faker.lorem.words(),
          credentials: faker.internet.password()
        }
        const id = faker.datatype.uuid()
        services.logIn.mockResolvedValueOnce({ username, id, whatever: 'foo' })
        services.generateTurnCredentials.mockResolvedValueOnce(turnCredentials)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { 
              logIn(username: "${username}", password: "${password}") { 
                player { id username } 
                turnCredentials { username credentials } 
              }
            }`
          }
        })
        expect(response.json()).toEqual({
          data: { logIn: { player: { id, username }, turnCredentials } }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.logIn).toHaveBeenCalledWith(username, password)
        expect(services.logIn).toHaveBeenCalledTimes(1)
        expect(services.generateTurnCredentials).toHaveBeenCalledWith(
          configuration.turn.secret
        )
        expect(services.generateTurnCredentials).toHaveBeenCalledTimes(1)
      })

      it('does not generates turn credentials on authentication failure', async () => {
        const username = faker.name.firstName()
        const password = faker.internet.password()
        services.logIn.mockResolvedValueOnce(null)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { 
              logIn(username: "${username}", password: "${password}") {
                player { id username } 
                turnCredentials { username credentials } 
              }
            }`
          }
        })
        expect(response.json()).toEqual({ data: { logIn: null } })
        expect(response.statusCode).toEqual(200)
        expect(services.logIn).toHaveBeenCalledWith(username, password)
        expect(services.logIn).toHaveBeenCalledTimes(1)
        expect(services.generateTurnCredentials).not.toHaveBeenCalled()
      })
    })

    describe('getCurrentPlayer query', () => {
      it('returns current player from authentication details', async () => {
        const username = faker.name.firstName()
        const id = faker.datatype.uuid()
        services.getPlayerById.mockResolvedValueOnce({
          id,
          username,
          foo: 'bar'
        })
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: { authorization: `Bearer ${id}` },
          payload: {
            query: `query { getCurrentPlayer { id username } }`
          }
        })
        expect(response.json()).toEqual({
          data: { getCurrentPlayer: { id, username } }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenCalledWith(id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
      })

      it('does not return current player without authentication details', async () => {
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `query { getCurrentPlayer { id username } }`
          }
        })
        expect(response.json()).toEqual({
          data: { getCurrentPlayer: null },
          errors: [expect.objectContaining({ message: 'Unauthorized' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).not.toHaveBeenCalled()
      })

      it('does not return current player with invalid authentication details', async () => {
        const id = faker.datatype.uuid()
        services.getPlayerById.mockResolvedValueOnce(null)
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: { authorization: `Bearer ${id}` },
          payload: {
            query: `query { getCurrentPlayer { id username } }`
          }
        })
        expect(response.json()).toEqual({
          data: { getCurrentPlayer: null },
          errors: [expect.objectContaining({ message: 'Unauthorized' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenCalledWith(id)
        expect(services.getPlayerById).toHaveBeenCalledTimes(1)
      })
    })

    describe('searchPlayer query', () => {
      it('returns matchings players', async () => {
        const search = faker.name.firstName()
        const players = [
          {
            id: faker.datatype.uuid(),
            username: faker.name.firstName()
          },
          {
            id: faker.datatype.uuid(),
            username: faker.name.firstName()
          }
        ]
        services.getPlayerById.mockResolvedValueOnce(players[0])
        services.searchPlayers.mockResolvedValueOnce([players[1]])
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          headers: { authorization: `Bearer ${players[0].id}` },
          payload: {
            query: `query { searchPlayers(search: "${search}") { id username } }`
          }
        })
        expect(response.json()).toEqual({
          data: { searchPlayers: [players[1]] }
        })
        expect(response.statusCode).toEqual(200)
        expect(services.searchPlayers).toHaveBeenCalledWith(
          search,
          players[0].id
        )
        expect(services.searchPlayers).toHaveBeenCalledTimes(1)
      })
    })
  })
})
