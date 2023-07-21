// @ts-check
import { setTimeout } from 'node:timers/promises'

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
import { clearDatabase, getRedisTestUrl } from '../test-utils.js'

/** @typedef {import('../../src/services/players.js').Player} Player */

describe('given a started server', () => {
  /** @type {import('fastify').FastifyInstance} */
  let server
  /** @type {import('ws')} */
  let ws
  /** @type {ReturnType<typeof mockMethods>} */
  let restoreServices
  const services =
    /** @type {import('../test-utils.js').MockedMethods<typeof realServices>} */ (
      realServices
    )
  vi.spyOn(makeLogger('graphql-plugin'), 'warn').mockImplementation(() => {})
  const pubsubUrl = getRedisTestUrl()
  const playerId = faker.string.uuid()
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

  describe('Signal GraphQL resolver', () => {
    describe('sendSignal mutation', () => {
      it('can not send signal without authentication', async () => {
        const signal = {
          to: faker.string.uuid(),
          data: JSON.stringify({ type: 'offer' })
        }
        const response = await server.inject({
          method: 'POST',
          url: 'graphql',
          payload: {
            query: `mutation { sendSignal(signal: ${toGraphQLArg(
              signal
            )}) { from data } }`
          }
        })
        expect(response.json().errors).toEqual([
          expect.objectContaining({ message: 'Unauthorized' })
        ])
        expect(response.statusCode).toEqual(200)
      })
    })

    describe('awaitSignal subscription', () => {
      it('sends signal and triggers subscription', async () => {
        const peerId = faker.string.uuid()
        const gameId = faker.string.uuid()
        const signal = { to: peerId, data: '{"type": "answer"}' }
        services.getPlayerById.mockImplementation(
          // @ts-expect-error: missing fields
          id => /** @type {Player} */ ({ id })
        )
        await startSubscription(
          ws,
          `subscription { awaitSignal(gameId: ${toGraphQLArg(
            gameId
          )}) { from data } }`,
          signToken(peerId, configuration.auth.jwt.key)
        )
        const signalPromise = waitOnMessage(ws)

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
            query: `mutation { sendSignal(signal: ${toGraphQLArg(
              signal
            )}) { from data } }`
          }
        })

        expect(response.json()).toEqual({
          data: {
            sendSignal: { from: playerId, data: signal.data }
          }
        })
        expect(response.statusCode).toEqual(200)
        await expect(signalPromise).resolves.toEqual(
          expect.objectContaining({
            payload: { data: { awaitSignal: response.json().data.sendSignal } }
          })
        )
        expect(services.getPlayerById).toHaveBeenNthCalledWith(1, peerId)
        expect(services.getPlayerById).toHaveBeenNthCalledWith(2, playerId)
        expect(services.getPlayerById).toHaveBeenCalledTimes(2)
      })

      it('sets current game Id based on subscription', async () => {
        const subId = faker.number.int()
        const gameId = faker.string.uuid()
        services.getPlayerById.mockImplementation(
          // @ts-expect-error: missing fields
          id => /** @type {Player} */ ({ id })
        )
        await startSubscription(
          ws,
          `subscription { awaitSignal(gameId: ${toGraphQLArg(
            gameId
          )}) { from data } }`,
          signToken(playerId, configuration.auth.jwt.key),
          subId
        )
        await setTimeout(500)
        expect(services.setCurrentGameId).toHaveBeenNthCalledWith(
          1,
          playerId,
          gameId
        )

        await stopSubscription(ws, subId)
        expect(services.setCurrentGameId).toHaveBeenNthCalledWith(
          2,
          playerId,
          null
        )
        expect(services.setCurrentGameId).toHaveBeenCalledTimes(2)
      })

      it('sends ready signal upon subscription', async () => {
        const subId = faker.number.int()
        const gameId = faker.string.uuid()
        services.getPlayerById.mockImplementation(
          // @ts-expect-error: missing fields
          id => /** @type {Player} */ ({ id })
        )
        const startPromise = startSubscription(
          ws,
          `subscription { awaitSignal(gameId: ${toGraphQLArg(
            gameId
          )}) { from data } }`,
          signToken(playerId, configuration.auth.jwt.key),
          subId
        )
        const signalPromise = waitOnMessage(ws, ({ type }) => type === 'data')
        await startPromise
        await expect(signalPromise).resolves.toEqual(
          expect.objectContaining({
            payload: {
              data: {
                awaitSignal: { from: 'server', data: '{"type":"ready"}' }
              }
            }
          })
        )
      })
    })
  })
})
