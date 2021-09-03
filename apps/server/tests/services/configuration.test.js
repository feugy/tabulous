import { jest } from '@jest/globals'
import faker from 'faker'
import { join, resolve } from 'path'
import { cwd } from 'process'
import { pathToFileURL } from 'url'
import { loadConfiguration } from '../../src/services/configuration.js'

describe('loadConfiguration()', () => {
  const { ...envSave } = process.env
  const cwdUrl = pathToFileURL(cwd()).toString()

  beforeEach(() => {
    process.env = { ...envSave }
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('loads values from environment variables', () => {
    const port = faker.datatype.number({ min: 0, max: 8000 })
    const host = faker.internet.ip()
    const level = faker.random.arrayElement(['fatal', 'error', 'info', 'debug'])
    const staticPath = resolve(cwd(), faker.system.directoryPath())
    const gamesPath = `file://${faker.system.directoryPath()}`
    const dataPath = faker.system.filePath()
    const key = faker.system.filePath()
    const cert = faker.system.filePath()

    process.env = {
      ...process.env,
      PORT: port,
      HOST: host,
      LOG_LEVEL: level,
      CLIENT_ROOT: staticPath,
      GAMES_PATH: gamesPath,
      DATA_PATH: dataPath,
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
        static: { path: staticPath }
      },
      games: { path: gamesPath },
      data: { path: dataPath }
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
        static: { path: resolve(cwd(), '..', 'web', 'dist') }
      },
      games: { path: `${cwdUrl}/games` },
      data: { path: resolve(cwd(), 'data') }
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
        static: { path: resolve(cwd(), '..', 'web', 'dist') }
      },
      games: { path: `${cwdUrl}/games` },
      data: { path: resolve(cwd(), 'data') }
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

  it('considers CLIENT_ROOT relatively to current working directory', () => {
    process.env.CLIENT_ROOT = join('.', 'test')
    expect(loadConfiguration().plugins.static.path).toEqual(join(cwd(), 'test'))
  })

  it('considers GAMES_PATH relatively to current working directory', () => {
    process.env.GAMES_PATH = './test'
    expect(loadConfiguration().games.path).toEqual(`${cwdUrl}/test`)
  })

  it('considers DATA_PATH relatively to current working directory', () => {
    process.env.DATA_PATH = './test'
    expect(loadConfiguration().data.path).toEqual(join(cwd(), 'test'))
  })
})