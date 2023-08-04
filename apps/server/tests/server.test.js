// @ts-check
/**
 * @typedef {import('../src/server').Server} Server
 * @typedef {import('../src/services/configuration').Configuration} Configuration
 */

// mandatory side effect for vi to load auth plugin
import '../src/plugins/utils.js'

import { createServer } from 'http'
import { resolve } from 'path'
import { cwd } from 'process'
import { fileURLToPath } from 'url'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import repositories from '../src/repositories/index.js'
import { startServer } from '../src/server.js'

describe('startServer()', () => {
  /** @type {Server}} */
  let app
  /** @type {number} */
  let port

  beforeAll(() => {
    vi.spyOn(repositories.games, 'connect').mockImplementation(async () => {})
    vi.spyOn(repositories.players, 'connect').mockImplementation(async () => {})
    vi.spyOn(repositories.catalogItems, 'connect').mockImplementation(
      async () => {}
    )
  })

  beforeEach(async () => {
    vi.resetAllMocks()
    const dummy = createServer()
    await dummy.listen()
    // @ts-expect-error: Server.address(): string | AddressInfo | null: Object is possibly 'null'.ts(2531)
    port = dummy.address().port
    dummy.close()
  })

  afterEach(() => app?.close())

  it('starts app on given port', async () => {
    app = await startServer({
      isProduction: true,
      serverUrl: { host: undefined, port },
      logger: { level: 'fatal' },
      plugins: {
        static: {
          pathPrefix: '/',
          path: resolve(
            fileURLToPath(import.meta.url),
            '..',
            'fixtures',
            'games'
          )
        },
        graphql: { allowedOrigins: '', pubsubUrl: '' },
        cors: { allowedOrigins: '' }
      },
      data: { url: 'data' },
      games: { path: 'games' },
      auth: {
        domain: 'funkytown.com',
        allowedOrigins: '.*',
        jwt: { key: 'dummy-test-key' },
        github: { id: 'github_client_id', secret: 'github_secret' }
      },
      turn: { secret: 'blah' }
    })

    let response = await app.inject({
      method: 'POST',
      url: 'graphql',
      payload: { query: 'mutation { logIn { player { id } } }' }
    })
    expect(response.json()?.errors?.[0]?.message).toMatch(
      /argument "id" of type "ID!" is required/
    )
    expect(response.statusCode).toEqual(200)

    response = await app.inject({ url: 'splendor/index.js' })
    expect(response.statusCode).toEqual(200)
    expect(repositories.games.connect).toHaveBeenCalledWith({ url: 'data' })
    expect(repositories.games.connect).toHaveBeenCalledOnce()
    expect(repositories.players.connect).toHaveBeenCalledWith({ url: 'data' })
    expect(repositories.players.connect).toHaveBeenCalledOnce()
    expect(repositories.catalogItems.connect).toHaveBeenCalledWith({
      path: 'games'
    })
    expect(repositories.catalogItems.connect).toHaveBeenCalledOnce()
  })

  it('decorates app with configuration property', async () => {
    /** @type {Configuration} */
    const conf = {
      isProduction: true,
      serverUrl: { host: undefined, port },
      logger: { level: 'error' },
      plugins: {
        static: { path: resolve(cwd(), 'games'), pathPrefix: '' },
        graphql: { allowedOrigins: '', pubsubUrl: '' },
        cors: { allowedOrigins: '' }
      },
      data: { url: 'data' },
      games: { path: 'games' },
      auth: {
        domain: 'funkytown.com',
        allowedOrigins: '.*',
        jwt: { key: 'dummy-test-key' },
        github: { id: 'github_client_id', secret: 'github_secret' }
      },
      turn: { secret: 'blah' }
    }
    app = await startServer(conf)
    expect(app.conf).toEqual(conf)
  })
})
