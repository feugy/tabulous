import fastify from 'fastify'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import staticPlugin from '../../src/plugins/static.js'

describe('static plugin', () => {
  let server

  afterEach(() => server?.close())

  it('serves static files', async () => {
    server = fastify({ logger: false })
    server.register(staticPlugin, {
      path: resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'games')
    })
    await server.listen()
    expect(await server.inject({ url: 'splendor.js' })).toHaveProperty(
      'statusCode',
      200
    )
    expect(await server.inject({ url: 'unknown' })).toHaveProperty(
      'statusCode',
      404
    )
  })
})
