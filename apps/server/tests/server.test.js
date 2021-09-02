import { jest } from '@jest/globals'
import { createServer } from 'http'
import { join, resolve } from 'path'
import { cwd } from 'process'
import repositories from '../src/repositories/index.js'
import { startServer } from '../src/server.js'

describe('startServer()', () => {
  let app
  let port

  beforeAll(() => {
    jest.spyOn(repositories.games, 'connect').mockImplementation(() => {})
    jest.spyOn(repositories.players, 'connect').mockImplementation(() => {})
  })

  beforeEach(async () => {
    jest.resetAllMocks()
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
      plugins: { static: { path: resolve(cwd(), 'games') } },
      data: { path: 'data' }
    })

    let response = await app.inject({
      method: 'POST',
      url: 'graphql',
      payload: { query: 'mutation { logIn { id } }' }
    })
    expect(response.json()?.errors?.[0]?.message).toMatch(
      /argument "username" of type "String!" is required/
    )
    expect(response.statusCode).toEqual(400)

    response = await app.inject({ url: 'splendor.js' })
    expect(response.statusCode).toEqual(200)
    expect(repositories.games.connect).toHaveBeenCalledWith({ path: 'data' })
    expect(repositories.games.connect).toHaveBeenCalledTimes(1)
    expect(repositories.players.connect).toHaveBeenCalledWith({ path: 'data' })
    expect(repositories.players.connect).toHaveBeenCalledTimes(1)
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
        data: { path: 'data' }
      })
    ).rejects.toThrow(/base64 decode/)
  })

  it('decorates app with configuration property', async () => {
    const conf = {
      serverUrl: { port },
      logger: { level: 'fatal' },
      plugins: { static: { path: resolve(cwd(), 'games') } },
      data: { path: 'data' }
    }
    app = await startServer(conf)
    expect(app.conf).toEqual(conf)
  })
})
