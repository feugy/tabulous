import fastify from 'fastify'
import WebSocket from 'ws'
import graphql from '../../src/plugins/graphql.js'

describe('graphql plugin', () => {
  let server

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
  })
})
