import { faker } from '@faker-js/faker'
import fastify from 'fastify'
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
import WebSocket from 'ws'

import graphql from '../../src/plugins/graphql.js'
import services from '../../src/services/index.js'
import { mockMethods } from '../test-utils.js'

describe('graphql plugin', () => {
  let server
  let restoreServices
  let warn = vi.spyOn(console, 'warn')

  beforeAll(() => {
    restoreServices = mockMethods(services)
  })

  beforeEach(vi.resetAllMocks)

  afterAll(async () => {
    restoreServices()
    await server?.close()
  })

  afterEach(() => server?.close())

  it('denies Websocket connection from a different origin', async () => {
    server = fastify({ logger: false })
    server.register(graphql, { allowedOrigins: `https:\\/\\/test\\.fr` })
    await server.listen()
    const ws = new WebSocket(
      `ws://localhost:${server.server.address().port}/graphql`,
      'graphql-ws'
    )
    await expect(
      new Promise((resolve, reject) => {
        ws.once('open', resolve)
        ws.once('error', reject)
      })
    ).rejects.toThrow('Unexpected server response: 401')
    expect(warn).toHaveBeenCalledTimes(0)
  })

  it('logs errors', async () => {
    const configuration = {
      turn: { secret: faker.lorem.words() },
      auth: { jwt: { key: faker.string.uuid() } }
    }

    server = fastify({ logger: false })
    server.decorate('conf', configuration)
    server.register(graphql)
    await server.listen()

    const message = 'boom from services!'
    const error = new Error(message)

    services.getPlayerById.mockRejectedValue(error)

    const response = await server.inject({
      method: 'POST',
      url: 'graphql',
      payload: {
        query: `mutation { 
          logIn(id: "${faker.lorem.word()}", password: "${faker.internet.password()}") { 
            token
          }
        }`
      }
    })
    expect(response.statusCode).toEqual(200)
    expect(response.json()).toEqual({
      data: {
        logIn: null
      },
      errors: [
        {
          locations: [{ column: 11, line: 2 }],
          message,
          path: ['logIn']
        }
      ]
    })
    expect(warn).toHaveBeenCalledWith(error.stack)
    expect(warn).toHaveBeenCalledOnce()
  })
})
