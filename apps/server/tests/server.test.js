import { createServer } from 'http'
import { join, resolve } from 'path'
import { cwd } from 'process'
import { startServer } from '../src/server.js'

describe('startServer()', () => {
  let app
  let port

  beforeEach(async () => {
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
      plugins: { static: { path: resolve(cwd(), 'games') } }
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
        plugins: { static: { path: resolve(cwd(), 'games') } }
      })
    ).rejects.toThrow(/base64 decode/)
  })

  it('decorates app with configuration property', async () => {
    const conf = {
      serverUrl: { port },
      logger: { level: 'fatal' },
      plugins: { static: { path: resolve(cwd(), 'games') } }
    }
    app = await startServer(conf)
    expect(app.conf).toEqual(conf)
  })
})
