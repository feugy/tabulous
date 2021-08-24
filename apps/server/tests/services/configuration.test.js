import { join } from 'path'
import { jest } from '@jest/globals'
import faker from 'faker'
import { loadConfiguration } from '@src/services/configuration.js'

describe('loadConfiguration()', () => {
  const { ...envSave } = process.env

  beforeEach(() => {
    process.env = { ...envSave }
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('validates PORT variable', () => {
    process.env.PORT = 'invalid'
    expect(loadConfiguration).toThrow('/serverUrl/port must be uint16')
    process.env.PORT = -100
    expect(loadConfiguration).toThrow('/serverUrl/port must be uint16')
  })

  it('validates LOG_LEVEL variable', () => {
    process.env.LOG_LEVEL = 'invalid'
    expect(loadConfiguration).toThrow(
      '/logger/level must be equal to one of the allowed values'
    )
    process.env.PORT = true
    expect(loadConfiguration).toThrow(
      '/logger/level must be equal to one of the allowed values'
    )
  })

  it('loads values from environment variables', () => {
    const port = faker.datatype.number({ min: 0, max: 8000 })
    const host = faker.internet.ip()
    const level = faker.random.arrayElement(['fatal', 'error', 'info', 'debug'])
    const peerSignalPath = faker.lorem.slug()
    const staticPath = faker.system.directoryPath()
    const key = faker.system.filePath()
    const cert = faker.system.filePath()

    process.env = {
      ...process.env,
      PORT: port,
      HOST: host,
      LOG_LEVEL: level,
      CLIENT_ROOT: staticPath,
      WS_ENDPOINT: peerSignalPath,
      HTTPS_CERT: cert,
      HTTPS_KEY: key
    }

    expect(loadConfiguration()).toEqual({
      isProduction: false,
      serverUrl: { host, port },
      logger: { level },
      https: { key, cert },
      plugins: {
        graphql: { graphiql: 'playground' },
        peerSignal: { path: peerSignalPath },
        static: { path: staticPath }
      }
    })
  })

  it('loads production default values', () => {
    process.env.NODE_ENV = 'production'
    expect(loadConfiguration()).toEqual({
      isProduction: true,
      serverUrl: {
        host: '0.0.0.0',
        port: 443
      },
      logger: { level: 'debug' },
      https: {
        cert: 'keys/cert.pem',
        key: 'keys/privkey.pem'
      },
      plugins: {
        graphql: { graphiql: null },
        peerSignal: { path: '/ws' },
        static: { path: join('apps', 'web', 'dist') }
      }
    })
  })

  it('loads development default values', () => {
    expect(loadConfiguration()).toEqual({
      isProduction: false,
      serverUrl: {
        port: 3001
      },
      logger: { level: 'debug' },
      https: null,
      plugins: {
        graphql: { graphiql: 'playground' },
        peerSignal: { path: '/ws' },
        static: { path: join('apps', 'web', 'dist') }
      }
    })
  })
})
