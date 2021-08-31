import { resolve } from 'path'
import fastify from 'fastify'
import staticPlugin from '../../src/plugins/static'
import { fileURLToPath } from 'url'

describe('static plugin', () => {
  let server

  afterEach(() => server?.close())

  it('serves static files from an absolute path', async () => {
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

  it('serves static files from a relative path', async () => {
    server = fastify({ logger: false })
    server.register(staticPlugin, { path: 'games' })
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
