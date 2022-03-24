import fastify from 'fastify'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import staticPlugin from '../../src/plugins/static.js'

describe('static plugin', () => {
  let server

  afterEach(() => server?.close())

  it('serves static files', async () => {
    const pathPrefix = '/games'
    server = fastify({ logger: false })
    server.register(staticPlugin, {
      pathPrefix,
      path: resolve(
        fileURLToPath(import.meta.url),
        '..',
        '..',
        'fixtures',
        'games'
      )
    })
    await server.listen()
    expect(
      await server.inject({ url: `${pathPrefix}/splendor.js` })
    ).toHaveProperty('statusCode', 200)
    expect(
      await server.inject({ url: `${pathPrefix}/unknown` })
    ).toHaveProperty('statusCode', 404)
  })
})
