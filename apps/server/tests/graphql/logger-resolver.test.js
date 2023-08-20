// @ts-check
/**
 * @typedef {import('fastify').FastifyInstance} FastifyInstance
 * @typedef {import('../../src/services/players').Player} Player
 */

import { faker } from '@faker-js/faker'
import fastify from 'fastify'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import graphQL from '../../src/plugins/graphql.js'
import realServices from '../../src/services/index.js'
import {
  mockMethods,
  openGraphQLWebSocket,
  signToken,
  toGraphQLArg
} from '../test-utils.js'
import { clearDatabase, getRedisTestUrl } from '../test-utils.js'

describe('given a started server', () => {
  /** @type {FastifyInstance} */
  let server
  /** @type {import('ws')} */
  let ws
  /** @type {ReturnType<typeof mockMethods>} */
  let restoreServices
  const services =
    /** @type {import('../test-utils').MockedMethods<typeof realServices>} */ (
      realServices
    )
  const pubsubUrl = getRedisTestUrl()
  /** @type {Player} */
  const player = {
    isAdmin: true,
    id: faker.string.uuid(),
    username: 'Dumbo',
    currentGameId: null
  }
  const configuration = {
    auth: { jwt: { key: faker.string.uuid() } }
  }

  beforeAll(async () => {
    server = fastify({ logger: false })
    server.decorate('conf', configuration)
    server.register(graphQL, { allowedOrigins: '.*', pubsubUrl })
    await server.listen()
    ws = await openGraphQLWebSocket(server)
    restoreServices = mockMethods(services)
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
    await clearDatabase(pubsubUrl)
  })

  describe('logger GraphQL resolver', () => {
    describe('getLoggerLevels query', () => {
      it('returns currently confiugred loggers', async () => {
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
            query: `query { getLoggerLevels { name level } }`
          }
        })
        expect(response.json()).toEqual({
          data: {
            getLoggerLevels: expect.arrayContaining([
              { level: 'warn', name: 'players-service' },
              { level: 'warn', name: 'server' },
              { level: 'warn', name: 'signals-resolver' }
            ])
          }
        })
        expect(response.statusCode).toEqual(200)
      })

      it('denies anonymous access', async () => {
        services.getPlayerById.mockResolvedValueOnce(null)

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
            query: `query { getLoggerLevels { name level } }`
          }
        })

        expect(response.json()).toEqual({
          data: null,
          errors: [expect.objectContaining({ message: 'Unauthorized' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
      })

      it('denies un-priviledge access', async () => {
        services.getPlayerById.mockResolvedValueOnce({
          ...player,
          isAdmin: false
        })

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
            query: `query { getLoggerLevels { name level } }`
          }
        })

        expect(response.json()).toEqual({
          data: null,
          errors: [expect.objectContaining({ message: 'Forbidden' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
      })
    })

    describe('configureLoggerLevels mutation', () => {
      it('sets loggers new levels and returns them', async () => {
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
            query: `mutation { configureLoggerLevels (levels: ${toGraphQLArg([
              { name: 'server', level: 'debug' },
              { name: 'signals-resolver', level: 'info' }
            ])}) { name level } }`
          }
        })
        expect(response.json()).toEqual({
          data: {
            configureLoggerLevels: expect.arrayContaining([
              { level: 'warn', name: 'players-service' },
              { level: 'debug', name: 'server' },
              { level: 'info', name: 'signals-resolver' }
            ])
          }
        })
        expect(response.statusCode).toEqual(200)
      })

      it('denies anonymous access', async () => {
        services.getPlayerById.mockResolvedValueOnce(null)

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
            query: `mutation { configureLoggerLevels (levels: ${toGraphQLArg({
              name: 'server',
              level: 'debug'
            })}) { name level } }`
          }
        })

        expect(response.json()).toEqual({
          data: null,
          errors: [expect.objectContaining({ message: 'Unauthorized' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
      })

      it('denies un-priviledge access', async () => {
        services.getPlayerById.mockResolvedValueOnce({
          ...player,
          isAdmin: false
        })

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
            query: `mutation { configureLoggerLevels (levels: ${toGraphQLArg({
              name: 'server',
              level: 'debug'
            })}) { name level } }`
          }
        })

        expect(response.json()).toEqual({
          data: null,
          errors: [expect.objectContaining({ message: 'Forbidden' })]
        })
        expect(response.statusCode).toEqual(200)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, player.id)
        expect(services.getPlayerById).toHaveBeenCalledOnce()
      })
    })
  })
})
