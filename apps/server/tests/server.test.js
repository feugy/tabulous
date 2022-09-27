import { createServer } from 'http'
import { join, resolve } from 'path'
import { cwd } from 'process'
import { fileURLToPath } from 'url'
import repositories from '../src/repositories/index.js'
import { startServer } from '../src/server.js'
// mandatory side effect for vi to load auth plugin
import '../src/plugins/utils.js'

describe('startServer()', () => {
  let app
  let port

  beforeAll(() => {
    vi.spyOn(repositories.games, 'connect').mockImplementation(() => {})
    vi.spyOn(repositories.players, 'connect').mockImplementation(() => {})
    vi.spyOn(repositories.catalogItems, 'connect').mockImplementation(() => {})
  })

  beforeEach(async () => {
    vi.resetAllMocks()
    const dummy = createServer()
    await dummy.listen()
    port = dummy.address().port
    dummy.close()
  })

  afterEach(() => app?.close())

  it('starts app on given port', async () => {
    app = await startServer({
      serverUrl: { port },
      logger: { level: 'fatal' },
      plugins: {
        static: {
          path: resolve(
            fileURLToPath(import.meta.url),
            '..',
            'fixtures',
            'games'
          )
        }
      },
      data: { path: 'data' },
      games: { path: 'games' },
      turn: { secret: 'blabla' },
      auth: {
        jwt: { key: 'dummy-test-key' },
        github: { id: 'github_client_id', secret: 'github_secret' }
      }
    })

    let response = await app.inject({
      method: 'POST',
      url: 'graphql',
      payload: { query: 'mutation { logIn { player { id } } }' }
    })
    expect(response.json()?.errors?.[0]?.message).toMatch(
      /argument "id" of type "ID!" is required/
    )
    expect(response.statusCode).toEqual(400)

    response = await app.inject({ url: 'splendor/index.js' })
    expect(response.statusCode).toEqual(200)
    expect(repositories.games.connect).toHaveBeenCalledWith({ path: 'data' })
    expect(repositories.games.connect).toHaveBeenCalledTimes(1)
    expect(repositories.players.connect).toHaveBeenCalledWith({ path: 'data' })
    expect(repositories.players.connect).toHaveBeenCalledTimes(1)
    expect(repositories.catalogItems.connect).toHaveBeenCalledWith({
      path: 'games'
    })
    expect(repositories.catalogItems.connect).toHaveBeenCalledTimes(1)
  })

  it('reads https files and propagate errors', async () => {
    await expect(
      startServer({
        serverUrl: { port },
        https: {
          key: join('tests', 'fixtures', 'key.pem'),
          cert: join('tests', 'fixtures', 'cert.pem')
        },
        logger: { level: 'fatal' },
        plugins: { static: { path: resolve(cwd(), 'games') } },
        data: { path: 'data' },
        games: { path: 'games' },
        auth: { github: { id: 'github_client_id', secret: 'github_secret' } }
      })
    ).rejects.toThrow(/base64 decode/)
  })

  it('decorates app with configuration property', async () => {
    const conf = {
      serverUrl: { port },
      logger: { level: 'fatal' },
      plugins: { static: { path: resolve(cwd(), 'games') } },
      data: { path: 'data' },
      games: { path: 'games' },
      auth: {
        jwt: { key: 'dummy-test-key' },
        github: { id: 'github_client_id', secret: 'github_secret' }
      }
    }
    app = await startServer(conf)
    expect(app.conf).toEqual(conf)
  })
})
