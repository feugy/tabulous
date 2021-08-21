import { join } from 'path'
import Ajv from 'ajv/dist/jtd.js'

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
    plugins: {
      properties: {
        graphql: {
          properties: {
            graphiql: { type: 'string', nullable: true }
          }
        },
        peerSignal: {
          properties: {
            path: { type: 'string' }
          }
        },
        sse: {
          properties: {
            path: { type: 'string' }
          }
        },
        static: {
          properties: {
            path: { type: 'string' }
          }
        }
      }
    }
  }
})

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
 * @property {object} plugins - options for all plugin used::
 * @property {import('../plugins/graphql').GraphQLOptions} plugins.graphql - options for the GraphQL plugin.
 * @property {import('../plugins/peer-signal').PeerSignalOptions} plugins.peerSignal - options for the peer signaling plugin.
 * @property {import('../plugins/sse').SSEOptions} plugins.sse - options for the Server Sent Event plugin.
 * @property {import('../plugins/static').StaticOptions} plugins.static - options for the static files plugin.
 * @see {@link https://nodejs.org/docs/latest-v16.x/api/net.html#net_server_listen_options_callback}
 * @see {@link https://nodejs.org/docs/latest-v16.x/api/tls.html#tls_tls_createsecurecontext_options}
 * @see {@link https://github.com/pinojs/pino/blob/master/docs/api.md#options}
 */

/**
 * Synchronously loads and validates the server configuration from environment variables:
 * - CLIENT_ROOT: relative/absolute path to the folder containing UI static files. Default to 'apps/web/dist'.
 * - HOST : IP4/6 address this server will listen to.
 * - HTTPS_CERT: relative or absolute path to the PEM file of your SSL certificate. Required in production, defaults to 'keys/cert.pem'.
 * - HTTPS_KEY: relative or absolute path to the PEM file of your SSL key. Rrequired in production, defaults to 'keys/privkey.pem'.
 * - LOG_LEVEL: logger level used, one of 'trace', 'debug', 'info', 'warn', 'error', 'fatal'. Defaults to 'debug'.
 * - NODE_ENV: 'production' indicates production mode.
 * - PORT: server listening port (must be a number). Defaults to 443 in production, and 3001 otherwise.
 * - SSE_ENDPOINT: url of the server sent event endpoint. Defaults to '/sse'.
 * - WS_ENDPOINT: url of the web socket endpoint. Defaults to '/ws'.
 *
 * @returns {Configuration} the loaded configuration.
 * @throws {Error} when the provided environment variables do not match expected values.
 */
export function loadConfiguration() {
  const {
    CLIENT_ROOT,
    HOST,
    HTTPS_CERT,
    HTTPS_KEY,
    LOG_LEVEL,
    NODE_ENV,
    PORT,
    SSE_ENDPOINT,
    WS_ENDPOINT
  } = process.env

  const isProduction = /^\w*production\w*$/i.test(NODE_ENV)

  const configuration = {
    isProduction,
    serverUrl: {
      host: HOST ?? (isProduction ? '0.0.0.0' : undefined),
      port: PORT ? Number(PORT) : isProduction ? 443 : 3001
    },
    https:
      (HTTPS_KEY && HTTPS_CERT) || isProduction
        ? {
            key: HTTPS_KEY ?? join('keys', 'privkey.pem'),
            cert: HTTPS_CERT ?? join('keys', 'cert.pem')
          }
        : null,
    logger: { level: LOG_LEVEL ?? 'debug' },
    plugins: {
      graphql: { graphiql: isProduction ? null : 'playground' },
      peerSignal: { path: WS_ENDPOINT ?? '/ws' },
      sse: { path: SSE_ENDPOINT ?? '/sse' },
      static: { path: CLIENT_ROOT ?? join('apps', 'web', 'dist') }
    }
  }
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
