import { faker } from '@faker-js/faker'
import { jest } from '@jest/globals'
import { join, resolve } from 'path'
import { cwd } from 'process'
import { loadConfiguration } from '../../src/services/configuration.js'

describe('loadConfiguration()', () => {
  const { ...envSave } = process.env

  beforeEach(() => {
    process.env = { ...envSave }
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('loads values from environment variables', () => {
    const port = faker.datatype.number({ min: 0, max: 8000 })
    const host = faker.internet.ip()
    const level = faker.helpers.arrayElement([
      'fatal',
      'error',
      'info',
      'debug'
    ])
    const gamesPath = faker.system.directoryPath()
    const dataPath = faker.system.directoryPath()
    const key = faker.system.filePath()
    const cert = faker.system.filePath()
    const secret = faker.lorem.words()

    process.env = {
      ...process.env,
      PORT: port,
      HOST: host,
      LOG_LEVEL: level,
      GAMES_PATH: gamesPath,
      DATA_PATH: dataPath,
      HTTPS_CERT: cert,
      HTTPS_KEY: key,
      TURN_SECRET: secret
    }

    expect(loadConfiguration()).toEqual({
      isProduction: false,
      serverUrl: { host, port },
      logger: { level },
      https: { key, cert },
      plugins: {
        graphql: { graphiql: 'playground' },
        static: { path: gamesPath, pathPrefix: '/games' }
      },
      games: { path: gamesPath },
      data: { path: dataPath },
      turn: { secret }
    })
  })

  it('loads production default values', () => {
    const secret = faker.lorem.words()
    process.env.NODE_ENV = 'production'
    process.env.TURN_SECRET = secret

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
        static: {
          path: resolve(cwd(), '..', 'games', 'assets'),
          pathPrefix: '/games'
        }
      },
      games: { path: resolve(cwd(), '..', 'games', 'assets') },
      data: { path: resolve(cwd(), 'data') },
      turn: { secret }
    })
  })

  it('loads development default values', () => {
    const secret = faker.lorem.words()
    process.env.TURN_SECRET = secret

    expect(loadConfiguration()).toEqual({
      isProduction: false,
      serverUrl: {
        port: 3001
      },
      logger: { level: 'debug' },
      https: null,
      plugins: {
        graphql: { graphiql: 'playground' },
        static: {
          path: resolve(cwd(), '..', 'games', 'assets'),
          pathPrefix: '/games'
        }
      },
      games: { path: resolve(cwd(), '..', 'games', 'assets') },
      data: { path: resolve(cwd(), 'data') },
      turn: { secret }
    })
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

  it('considers GAMES_PATH relatively to current working directory', () => {
    process.env.TURN_SECRET = faker.lorem.words()
    process.env.CLIENT_ROOT = join('.', 'test')
    process.env.GAMES_PATH = join('.', 'test2')
    expect(loadConfiguration().plugins.static.path).toEqual(
      join(cwd(), 'test2')
    )
    expect(loadConfiguration().games.path).toEqual(join(cwd(), 'test2'))
  })

  it('considers DATA_PATH relatively to current working directory', () => {
    process.env.TURN_SECRET = faker.lorem.words()
    process.env.DATA_PATH = './test'
    expect(loadConfiguration().data.path).toEqual(join(cwd(), 'test'))
  })
})
