import { createServer } from 'http'
import { join } from 'path'
import { startServer } from '../src/server'

describe('startServer()', () => {
  let server
  let port

  beforeEach(async () => {
    const dummy = createServer()
    await dummy.listen()
    port = dummy.address().port
    dummy.close()
  })

  afterEach(() => server?.close())

  it('starts server on given port', async () => {
    server = await startServer({
      serverUrl: { port },
      logger: { level: 'fatal' },
      plugins: { static: { path: 'games' } }
    })

    let response = await server.inject({
      method: 'POST',
      url: 'graphql',
      payload: { query: 'mutation { logIn { id } }' }
    })
    expect(response.json()?.errors?.[0]?.message).toMatch(
      /argument "username" of type "String!" is required/
    )
    expect(response.statusCode).toEqual(400)

    response = await server.inject({ url: 'splendor.js' })
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
        plugins: { static: { path: 'games' } }
      })
    ).rejects.toThrow(/base64 decode/)
  })
})
