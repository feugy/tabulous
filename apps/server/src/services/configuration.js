// @ts-check
/**
 * @typedef {import('../plugins/auth').AuthOptions} AuthOptions
 * @typedef {import('../plugins/graphql').GraphQLOptions} GraphQLOptions
 * @typedef {import('../plugins/static').StaticOptions} StaticOptions
 * @typedef {import('../plugins/cors').CorsOptions} CorsOptions
 * @typedef {import('../utils/logger').Level} Level
 */

import { isAbsolute, join } from 'node:path'
import { cwd } from 'node:process'

import Ajv from 'ajv/dist/jtd.js'

import { makeLogger } from '../utils/index.js'

/**
 * @typedef {object} DataOptions
 * @property {string} url - database connection string.
 */

/**
 * @typedef {object} LoggerOptions
 * @property {Level} level - level used for logging.
 */

/**
 * @typedef {object} GamesOpptions
 * @property {string} path - folder path (relative to current working directory) containing game descriptors.
 */

/**
 * @typedef {object} Configuration loaded configuration, including:
 * @property {boolean} isProduction - indicates production mode.
 * @property {object} serverUrl - node's `server.listen()` url object, including:
 * @property {string} [serverUrl.host] - IP4/6 address this server will listen to.
 * @property {number} serverUrl.port - server listening port.
 * @property {LoggerOptions} logger - Pino logger options, including:
 * @property {DataOptions} data - configuration to connect to the database:
 * @property {GamesOpptions} games - game engine properties, including;
 * @property {AuthOptions} auth - options for the authentication plugin.
 * @property {object} plugins - options for all plugin used:
 * @property {GraphQLOptions} plugins.graphql - options for the GraphQL plugin.
 * @property {StaticOptions} plugins.static - options for the static files plugin.
 * @property {CorsOptions} plugins.cors - options for the CORS plugin.
 * @property {{secret: string}} turn - configuratino for the TURN server.
 * @see {@link https://nodejs.org/docs/latest-v16.x/api/net.html#net_server_listen_options_callback}
 * @see {@link https://nodejs.org/docs/latest-v16.x/api/tls.html#tls_tls_createsecurecontext_options}
 * @see {@link https://github.com/pinojs/pino/blob/master/docs/api.md#options}
 */

const logger = makeLogger('configuration-service')

const validate = new Ajv({ allErrors: true }).compile({
  properties: {
    isProduction: { type: 'boolean' },
    serverUrl: {
      properties: {
        port: { type: 'uint16' }
      },
      optionalProperties: {
        host: { type: 'string' }
      }
    },
    logger: {
      properties: {
        level: { enum: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] }
      }
    },
    games: {
      properties: {
        path: { type: 'string' }
      }
    },
    data: {
      properties: {
        url: { type: 'string' }
      }
    },
    plugins: {
      properties: {
        graphql: {
          properties: {
            pubsubUrl: { type: 'string' }
          },
          optionalProperties: {
            graphiql: { type: 'boolean' },
            allowedOrigins: { type: 'string' }
          }
        },
        static: {
          properties: {
            pathPrefix: { type: 'string' },
            path: { type: 'string' }
          }
        },
        cors: {
          properties: {
            allowedOrigins: { type: 'string' }
          }
        }
      }
    },
    turn: {
      properties: {
        secret: { type: 'string' }
      }
    },
    auth: {
      properties: {
        jwt: {
          properties: {
            key: { type: 'string' }
          }
        },
        domain: { type: 'string' },
        allowedOrigins: { type: 'string' }
      },
      optionalProperties: {
        github: {
          properties: {
            id: { type: 'string' },
            secret: { type: 'string' }
          }
        },
        google: {
          properties: {
            id: { type: 'string' },
            secret: { type: 'string' }
          }
        }
      }
    }
  }
})

/**
 * @param {string} path
 * @returns {string}
 */
function makeAbsolute(path) {
  return isAbsolute(path) ? path : join(cwd(), path)
}

/**
 * Synchronously loads and validates the server configuration from environment variables:
 * - REDIS_URL: connection URL, including credentials, to connect to Redis database. Required in production, defaults to 'redis://127.0.0.1:6379' otherwise
 * - PUBSUB_URL: connection URL, including credentials, to connect to PubSub provider. Required in production, defaults to 'redis://127.0.0.1:6379' otherwise
 * - GOOGLE_SECRET: Optional Google OAuth application secret used to identify players.
 * - GAMES_PATH: folder path (relative to current working directory) containing game descriptors and assets. Defaults to '../games'.
 * - HOST : IP4/6 address this server will listen to.
 * - LOG_LEVEL: logger level used, one of 'trace', 'debug', 'info', 'warn', 'error', 'fatal'. Defaults to 'debug'.
 * - NODE_ENV: 'production' indicates production mode.
 * - PORT: server listening port (must be a number). Defaults to 443 in production, and 3001 otherwise.
 * - JWT_KEY: key used to sign JWT sent to the client. Required in production.
 * - TURN_SECRET: secret used to generate turn credentials. Must be the same as coTURN static-auth-secret.
 * - AUTH_DOMAIN: public facing domain (full url) for authentication redirections. Defaults to https://auth.tabulous.fr in production, and http://localhost:3001 otherwise
 * - ALLOWED_ORIGINS_REGEXP: regular expression for allowed domains, used in CORS and authentication redirections.
 * - GITHUB_ID: Optional Github OAuth application ID used to identify players.
 * - GITHUB_SECRET: Optional Github OAuth application secret used to identify players.
 * - GOOGLE_ID: Optional Google OAuth application ID used to identify players.
 * - GOOGLE_SECRET: Optional Google OAuth application secret used to identify players.
 *
 * @returns {Configuration} the loaded configuration.
 * @throws {Error} when the provided environment variables do not match expected values.
 */
export function loadConfiguration() {
  logger.trace('loading configuration')
  const {
    AUTH_DOMAIN,
    ALLOWED_ORIGINS_REGEXP,
    GAMES_PATH,
    GITHUB_ID,
    GITHUB_SECRET,
    GOOGLE_ID,
    GOOGLE_SECRET,
    HOST,
    JWT_KEY,
    LOG_LEVEL,
    NODE_ENV,
    PORT,
    PUBSUB_URL,
    REDIS_URL,
    TURN_SECRET
  } = process.env

  // @ts-expect-error: NODE_ENV: Argument of type 'string | undefined' is not assignable to parameter of type 'string'
  const isProduction = /^\w*production\w*$/i.test(NODE_ENV)
  const allowedOrigins =
    ALLOWED_ORIGINS_REGEXP ??
    (isProduction
      ? '^https?:\\/\\/(?:(?:.+\\.)?tabulous\\.(?:fr|games)|tabulous(?:-.+)?\\.vercel\\.app)'
      : '^https?:\\/\\/localhost:\\d+')

  /** @type {Configuration} */
  const configuration = {
    isProduction,
    serverUrl: {
      host: HOST ?? (isProduction ? '0.0.0.0' : undefined),
      port: PORT ? Number(PORT) : 3001
    },
    logger: {
      // @ts-expect-error: Type 'string' is not assignable to type 'Level'
      level: LOG_LEVEL ?? 'debug'
    },
    plugins: {
      graphql: {
        graphiql: !isProduction,
        allowedOrigins,
        // @ts-expect-error: Type 'string | undefined' is not assignable to type 'string'
        pubsubUrl:
          PUBSUB_URL ?? (isProduction ? undefined : 'redis://127.0.0.1:6379')
      },
      static: {
        pathPrefix: '/games',
        path: ''
      },
      cors: {
        allowedOrigins
      }
    },
    games: {
      path: GAMES_PATH ?? join('..', 'games')
    },
    data: {
      // @ts-expect-error: Type 'string | undefined' is not assignable to type 'string'
      url: REDIS_URL ?? (isProduction ? undefined : 'redis://127.0.0.1:6379')
    },
    turn: {
      // @ts-expect-error: Type 'string | undefined' is not assignable to type 'string'
      secret: TURN_SECRET
    },
    auth: {
      jwt: {
        // @ts-expect-error: Type 'string | undefined' is not assignable to type 'string'
        key: JWT_KEY ?? (isProduction ? undefined : 'dummy-test-key')
      },
      domain:
        AUTH_DOMAIN ??
        (isProduction
          ? 'https://auth.tabulous.fr'
          : 'http://localhost:3001/auth'),
      allowedOrigins
    }
  }
  if (GITHUB_ID && GITHUB_SECRET) {
    configuration.auth.github = { id: GITHUB_ID, secret: GITHUB_SECRET }
  }
  if (GOOGLE_ID && GOOGLE_SECRET) {
    configuration.auth.google = { id: GOOGLE_ID, secret: GOOGLE_SECRET }
  }
  configuration.games.path = makeAbsolute(configuration.games.path)
  configuration.plugins.static.path = configuration.games.path

  logger.trace('checking configuration')
  if (!validate(configuration)) {
    logger.fatal(
      { errors: validate.errors },
      'configuration is invalid: please check your environment variables'
    )
    throw new Error(
      // @ts-expect-error: 'validate.errors' is possibly 'null' or 'undefined'
      validate.errors.reduce(
        (message, error) =>
          `${message}\n${error.instancePath} ${error.message}`,
        ''
      )
    )
  }
  logger.debug('loaded configuration')
  return configuration
}
