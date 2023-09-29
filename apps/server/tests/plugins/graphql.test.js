// @ts-check
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
import realServices from '../../src/services/index.js'
import { makeLogger } from '../../src/utils/index.js'
import { mockMethods } from '../test-utils.js'

describe('graphql plugin', () => {
  /** @type {import('fastify').FastifyInstance} */
  let server
  /** @type {ReturnType<typeof mockMethods>} */
  let restoreServices
  let warn = vi.spyOn(makeLogger('graphql-plugin'), 'warn')
  const services =
    /** @type {import('../test-utils').MockedMethods<typeof realServices>} */ (
      realServices
    )

  beforeAll(() => {
    restoreServices = mockMethods(realServices)
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterAll(async () => {
    restoreServices()
    await server?.close()
  })

  afterEach(() => server?.close())

  it('denies Websocket connection from a different origin', async () => {
    server = fastify({ logger: false })
    server.register(graphql, {
      allowedOrigins: `https:\\/\\/test\\.fr`,
      pubsubUrl: ''
    })
    await server.listen()
    const ws = new WebSocket(
      `ws://localhost:${
        /** @type {{ port: number }} */ (server.server.address()).port
      }/graphql`,
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
      data: null,
      errors: [
        {
          locations: [{ column: 11, line: 2 }],
          message,
          path: ['logIn']
        }
      ]
    })
    expect(warn).toHaveBeenCalledWith(
      { errors: [expect.objectContaining({ message })] },
      'graphQL errors'
    )
    expect(warn).toHaveBeenCalledOnce()
  })
})
