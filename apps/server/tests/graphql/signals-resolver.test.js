import { jest } from '@jest/globals'
import faker from 'faker'
import fastify from 'fastify'
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
  const playerId = faker.datatype.uuid()

  beforeAll(async () => {
    server = fastify({ logger: false })
    server.register(graphQL)
    await server.listen()
    ws = await openGraphQLWebSocket(server)
    // monkey patch services
    for (const method in services) {
      services[method] = jest.fn()
    }
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

  describe('Signal GraphQL resolver', () => {
    it('can not send signal without authentication', async () => {
      const signal = { type: 'offer', to: faker.datatype.uuid(), signal: '--' }
      const response = await server.inject({
        method: 'POST',
        url: 'graphql',
        payload: {
          query: `mutation { 
  sendSignal(signal: ${toGraphQLArg(signal)}) {
    type
    from
    signal
  }
}`
        }
      })
      expect(response.json().errors).toEqual([
        expect.objectContaining({ message: 'Unauthorized' })
      ])
      expect(response.statusCode).toEqual(200)
    })

    it('sends signal and triggers subscription', async () => {
      const peerId = faker.datatype.uuid()
      const data = { type: 'answer', to: peerId, signal: 'whatever' }
      services.getPlayerById.mockImplementation(id => ({ id }))
      await startSubscription(
        ws,
        'subscription { awaitSignal { type from signal } }',
        peerId
      )
      const listPromise = waitOnMessage(ws)

      const response = await server.inject({
        method: 'POST',
        url: 'graphql',
        headers: { authorization: `Bearer ${playerId}` },
        payload: {
          query: `mutation { 
  sendSignal(signal: ${toGraphQLArg(data)}) {
    type
    from
    signal
  }
}`
        }
      })

      expect(response.json()).toEqual({
        data: {
          sendSignal: {
            type: data.type,
            from: playerId,
            signal: data.signal
          }
        }
      })
      expect(response.statusCode).toEqual(200)
      await expect(listPromise).resolves.toEqual(
        expect.objectContaining({
          payload: { data: { awaitSignal: response.json().data.sendSignal } }
        })
      )
      expect(services.getPlayerById).toHaveBeenNthCalledWith(1, peerId)
      expect(services.getPlayerById).toHaveBeenNthCalledWith(2, playerId)
      expect(services.getPlayerById).toHaveBeenCalledTimes(2)
    })

    it('sets playing status based on subscription', async () => {
      const subId = faker.datatype.number()
      services.getPlayerById.mockImplementation(id => ({ id }))
      await startSubscription(
        ws,
        'subscription { awaitSignal { type from signal } }',
        playerId,
        subId
      )
      expect(services.setPlaying).toHaveBeenNthCalledWith(1, playerId, true)

      await stopSubscription(ws, subId)
      expect(services.setPlaying).toHaveBeenNthCalledWith(2, playerId, false)
      expect(services.setPlaying).toHaveBeenCalledTimes(2)
    })
  })
})
