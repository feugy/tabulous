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
            key: HTTPS_KEY ?? 'keys/privkey.pem',
            cert: HTTPS_CERT ?? 'keys/cert.pem'
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
