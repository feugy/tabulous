import Ajv from 'ajv/dist/jtd.js'
import { isAbsolute, join } from 'path'
import { cwd } from 'process'

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
    https: {
      properties: {
        key: { type: 'string' },
        cert: { type: 'string' }
      },
      nullable: true
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
        path: { type: 'string' }
      }
    },
    plugins: {
      properties: {
        graphql: {
          optionalProperties: {
            graphiql: { type: 'string', nullable: true },
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

function makeAbsolute(path) {
  return isAbsolute(path) ? path : join(cwd(), path)
}

/**
 * @typedef {object} Configuration loaded configuration, including:
 * @property {boolean} isProduction - indicates production mode.
 * @property {object} serverUrl - node's `server.listen()` url object, including:
 * @property {string} serverUrl.host - IP4/6 address this server will listen to.
 * @property {number} serverUrl.port - server listening port.
 * @property {object} https - node's `tls.createSecureContext()` options, including:
 * @property {string} https.key - relative or absolute path to the PEM file of your SSL key.
 * @property {string} https.cert - relative or absolute path to the PEM file of your SSL certificate.
 * @property {object} logger - Pino logger options, including:
 * @property {string} logger.level - level used for logging.
 * @property {object} games - game engine properties, including;
 * @property {string} games.path - folder path (relative to current working directory) containing game descriptors.
 * @property {object} plugins - options for all plugin used:
 * @property {import('../plugins/graphql').GraphQLOptions} plugins.graphql - options for the GraphQL plugin.
 * @property {import('../plugins/static').StaticOptions} plugins.static - options for the static files plugin.
 * @property {import('../plugins/auth').AuthOptions} plugins.auth - options for the authentication plugin.
 * @see {@link https://nodejs.org/docs/latest-v16.x/api/net.html#net_server_listen_options_callback}
 * @see {@link https://nodejs.org/docs/latest-v16.x/api/tls.html#tls_tls_createsecurecontext_options}
 * @see {@link https://github.com/pinojs/pino/blob/master/docs/api.md#options}
 */

/**
 * Synchronously loads and validates the server configuration from environment variables:
 * - DATA_PATH: folder path (relative to current working directory) containing data stores. Defaults to './data'.
 * - GAMES_PATH: folder path (relative to current working directory) containing game descriptors and assets. Defaults to '../games/assets'.
 * - HOST : IP4/6 address this server will listen to.
 * - HTTPS_CERT: relative or absolute path to the PEM file of your SSL certificate. Required in production, defaults to 'keys/cert.pem'.
 * - HTTPS_KEY: relative or absolute path to the PEM file of your SSL key. Rrequired in production, defaults to 'keys/privkey.pem'.
 * - LOG_LEVEL: logger level used, one of 'trace', 'debug', 'info', 'warn', 'error', 'fatal'. Defaults to 'debug'.
 * - NODE_ENV: 'production' indicates production mode.
 * - PORT: server listening port (must be a number). Defaults to 443 in production, and 3001 otherwise.
 * - JWT_KEY: key used to sign JWT sent to the client.
 * - TURN_SECRET: secret used to generate turn credentials. Must be the same as coTURN static-auth-secret.
 * - DOMAIN_URL: public facing domain (full url) for authentication redirections. Defaults to https://tabulous.fr in production, and https://localhost:3000 otherwise
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
  const {
    DATA_PATH,
    DOMAIN_URL,
    ALLOWED_ORIGINS_REGEXP,
    GAMES_PATH,
    GITHUB_ID,
    GITHUB_SECRET,
    GOOGLE_ID,
    GOOGLE_SECRET,
    HOST,
    HTTPS_CERT,
    HTTPS_KEY,
    JWT_KEY,
    LOG_LEVEL,
    NODE_ENV,
    PORT,
    TURN_SECRET
  } = process.env

  const isProduction = /^\w*production\w*$/i.test(NODE_ENV)
  const allowedOrigins =
    ALLOWED_ORIGINS_REGEXP ??
    (isProduction
      ? '^https:\\/\\/(?:(?:.+\\.)?tabulous\\.(?:fr|games)|.+-feugy\\.vercel\\.app)'
      : '^https:\\/\\/localhost:3000')

  const configuration = {
    isProduction,
    serverUrl: {
      host: HOST ?? (isProduction ? '0.0.0.0' : undefined),
      port: PORT ? Number(PORT) : 3001
    },
    https:
      HTTPS_KEY && HTTPS_CERT
        ? {
            key: HTTPS_KEY,
            cert: HTTPS_CERT
          }
        : null,
    logger: { level: LOG_LEVEL ?? 'debug' },
    plugins: {
      graphql: {
        graphiql: isProduction ? null : 'playground',
        allowedOrigins
      },
      static: {
        pathPrefix: '/games'
      },
      cors: {
        allowedOrigins
      }
    },
    games: {
      path: GAMES_PATH ?? join('..', 'games', 'assets')
    },
    data: {
      path: DATA_PATH ?? 'data'
    },
    turn: {
      secret: TURN_SECRET
    },
    auth: {
      jwt: {
        key: JWT_KEY ?? (isProduction ? undefined : 'dummy-test-key')
      },
      domain:
        DOMAIN_URL ??
        (isProduction ? 'https://tabulous.fr' : 'https://localhost:3000'),
      allowedOrigins
    }
  }
  if (GITHUB_ID && GITHUB_SECRET) {
    configuration.auth.github = { id: GITHUB_ID, secret: GITHUB_SECRET }
  }
  if (GOOGLE_ID && GOOGLE_SECRET) {
    configuration.auth.google = { id: GOOGLE_ID, secret: GOOGLE_SECRET }
  }
  configuration.data.path = makeAbsolute(configuration.data.path)
  configuration.games.path = makeAbsolute(configuration.games.path)
  configuration.plugins.static.path = configuration.games.path

  if (!validate(configuration)) {
    console.warn(
      `Configuration is invalid: please check your environment variables.\n`,
      validate.errors
    )
    throw new Error(
      validate.errors.reduce(
        (message, error) =>
          `${message}\n${error.instancePath} ${error.message}`,
        ''
      )
    )
  }
  return configuration
}
