import { faker } from '@faker-js/faker'
import { join, resolve } from 'path'
import { cwd } from 'process'
import { loadConfiguration } from '../../src/services/configuration.js'

describe('loadConfiguration()', () => {
  const { ...envSave } = process.env
  const jwtKey = faker.internet.password()
  const turnSecret = faker.lorem.words()
  const githubId = faker.datatype.uuid()
  const githubSecret = faker.internet.password()
  const googleId = faker.datatype.uuid()
  const googleSecret = faker.internet.password()
  const redisUrl = faker.internet.url()
  const pubsubUrl = faker.internet.url()

  beforeEach(() => {
    process.env = { ...envSave }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
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
    const key = faker.system.filePath()
    const cert = faker.system.filePath()
    const domain = faker.internet.url()
    const allowedOrigins = faker.internet.url()

    process.env = {
      ...process.env,
      AUTH_DOMAIN: domain,
      ALLOWED_ORIGINS_REGEXP: allowedOrigins,
      GAMES_PATH: gamesPath,
      GITHUB_ID: githubId,
      GITHUB_SECRET: githubSecret,
      GOOGLE_ID: googleId,
      GOOGLE_SECRET: googleSecret,
      HOST: host,
      HTTPS_CERT: cert,
      HTTPS_KEY: key,
      JWT_KEY: jwtKey,
      LOG_LEVEL: level,
      PORT: port,
      TURN_SECRET: turnSecret,
      REDIS_URL: redisUrl,
      PUBSUB_URL: pubsubUrl
    }

    expect(loadConfiguration()).toEqual({
      isProduction: false,
      serverUrl: { host, port },
      logger: { level },
      https: { key, cert },
      plugins: {
        graphql: {
          graphiql: 'playground',
          allowedOrigins,
          pubsubUrl
        },
        static: { path: gamesPath, pathPrefix: '/games' },
        cors: { allowedOrigins }
      },
      games: { path: gamesPath },
      data: { url: redisUrl },
      turn: { secret: turnSecret },
      auth: {
        domain,
        allowedOrigins,
        jwt: { key: jwtKey },
        github: { id: githubId, secret: githubSecret },
        google: { id: googleId, secret: googleSecret }
      }
    })
  })

  it('loads production default values', () => {
    process.env = {
      ...process.env,
      NODE_ENV: 'production',
      JWT_KEY: jwtKey,
      TURN_SECRET: turnSecret,
      GITHUB_ID: githubId,
      GITHUB_SECRET: githubSecret,
      GOOGLE_ID: googleId,
      GOOGLE_SECRET: googleSecret,
      REDIS_URL: redisUrl,
      PUBSUB_URL: pubsubUrl
    }
    const allowedOrigins =
      '^https:\\/\\/(?:(?:.+\\.)?tabulous\\.(?:fr|games)|tabulous(?:-.+)?\\.vercel\\.app)'

    expect(loadConfiguration()).toEqual({
      isProduction: true,
      serverUrl: {
        host: '0.0.0.0',
        port: 3001
      },
      logger: { level: 'debug' },
      https: null,
      plugins: {
        graphql: { graphiql: null, allowedOrigins, pubsubUrl },
        static: {
          path: resolve(cwd(), '..', 'games'),
          pathPrefix: '/games'
        },
        cors: { allowedOrigins }
      },
      games: { path: resolve(cwd(), '..', 'games') },
      data: {
        url: redisUrl
      },
      turn: { secret: turnSecret },
      auth: {
        domain: 'https://auth.tabulous.fr',
        allowedOrigins,
        jwt: { key: jwtKey },
        github: { id: githubId, secret: githubSecret },
        google: { id: googleId, secret: googleSecret }
      }
    })
  })

  it('reports missing variables', () => {
    process.env.NODE_ENV = 'production'
    expect(loadConfiguration).toThrow(`/turn must have property 'secret'`)
    expect(loadConfiguration).toThrow(`/auth/jwt must have property 'key'`)
    expect(loadConfiguration).toThrow(`/data must have property 'url'`)
    expect(loadConfiguration).toThrow(
      `/plugins/graphql must have property 'pubsubUrl'`
    )
  })

  describe('given required environment values', () => {
    beforeEach(() => {
      process.env.TURN_SECRET = turnSecret
    })

    it('loads development default values', () => {
      const allowedOrigins = '^https?:\\/\\/localhost:\\d+'

      expect(loadConfiguration()).toEqual({
        isProduction: false,
        serverUrl: {
          port: 3001
        },
        logger: { level: 'debug' },
        https: null,
        plugins: {
          graphql: {
            graphiql: 'playground',
            allowedOrigins,
            pubsubUrl: 'redis://127.0.0.1:6379'
          },
          static: {
            path: resolve(cwd(), '..', 'games'),
            pathPrefix: '/games'
          },
          cors: { allowedOrigins }
        },
        games: { path: resolve(cwd(), '..', 'games') },
        data: { url: 'redis://127.0.0.1:6379' },
        turn: { secret: turnSecret },
        auth: {
          jwt: { key: 'dummy-test-key' },
          domain: 'http://localhost:3001',
          allowedOrigins
        }
      })
    })

    it('conditionally loads Github auth provider details', () => {
      process.env = {
        ...process.env,
        GITHUB_ID: githubId,
        GITHUB_SECRET: githubSecret
      }

      expect(loadConfiguration().auth).toEqual({
        domain: 'http://localhost:3001',
        allowedOrigins: '^https?:\\/\\/localhost:\\d+',
        jwt: { key: 'dummy-test-key' },
        github: { id: githubId, secret: githubSecret }
      })
    })

    it('conditionally loads Google auth provider details', () => {
      process.env = {
        ...process.env,
        GOOGLE_ID: googleId,
        GOOGLE_SECRET: googleSecret
      }

      expect(loadConfiguration().auth).toEqual({
        domain: 'http://localhost:3001',
        allowedOrigins: '^https?:\\/\\/localhost:\\d+',
        jwt: { key: 'dummy-test-key' },
        google: { id: googleId, secret: googleSecret }
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
      process.env.CLIENT_ROOT = join('.', 'test')
      process.env.GAMES_PATH = join('.', 'test2')
      expect(loadConfiguration().plugins.static.path).toEqual(
        join(cwd(), 'test2')
      )
      expect(loadConfiguration().games.path).toEqual(join(cwd(), 'test2'))
    })
  })
})
