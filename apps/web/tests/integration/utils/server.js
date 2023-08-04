// @ts-check
import { faker } from '@faker-js/faker'
import cors from '@fastify/cors'
import staticPlugin from '@fastify/static'
import websocket from '@fastify/websocket'
import chalk from 'chalk-template'
import fastify from 'fastify'
import { join } from 'path'
import { fileURLToPath } from 'url'

const graphQlRoute = '/graphql'
const gameAssetsFolder = join(
  fileURLToPath(import.meta.url),
  '../../../../../games'
)
const debug = !!process.env.PWDEBUG || !!process.env.CI

/** @type {import('fastify').FastifyInstance} */
let server
// Store the current server context, that is, the mocks for current test.
// It prevents running tests in paralle, but it's acceptable, because parrallel test would be in
// different processes, and sharing the same mock server would be impossible.
/** @type {ServerContext} */
let serverContext

function log(/** @type {?string} */ reqId, /** @type {...any} */ ...args) {
  const now = new Date()
  debug &&
    console.log(
      chalk`{dim ${now.toLocaleTimeString()}.${now.getMilliseconds()}}`,
      chalk`{blueBright mock-server ${reqId ? `[${reqId}] ` : ''}}-`,
      ...args
    )
}

function logError(/** @type {?string} */ reqId, /** @type {...any} */ ...args) {
  const now = new Date()
  console.log(
    chalk`{dim ${now.toLocaleTimeString()}.${now.getMilliseconds()}}`,
    chalk`{red.bold mock-server [${reqId}]} -`,
    ...args
  )
}

/**
 * @typedef {(?object|string|boolean|number)[]} GraphQLMock
 * @typedef {Record<string, ?GraphQLMock|object|string|boolean|number>} GraphQLMocks mocks for multiple graphQL operations.
 * Each property name is the operation Name, while values are the returned data, or an array of returned data.
 */

/**
 * @typedef {object} GraphQlMockResult
 * @property {Record<string, string>} subscriptionIds - GaphQL subscription ids by their operation name.
 * @property {(receiver: (operation: string, message: ?) => void) => void} onSubscription - registers a unique callback called when receiving GraphQL subscription.
 * @property {(receiver: (operation: string, request: ?) => ?) => void} onQuery - registers a unique callback called when receiving GraphQL queries (and mutations). Can be used to override predefined responses
 * @property {(payload: ?) => void} sendToSubscription - sends a GraphQL response payload to the subscription.
 * @property {() => void} setTokenCookie - sets token cookie so SvelteKit server can issue requests to the mocked server.
 */

/**
 * @typedef {object} ServerContext
 * @property {Map<string, GraphQLMock>} responsesPerOperation
 * @property {Map<?, ?>} rankPerOperation
 * @property {import('@fastify/websocket').SocketStream} [wsConnection]
 * @property {GraphQlMockResult['subscriptionIds']} subscriptionIds
 * @property {GraphQlMockResult['sendToSubscription']} sendToSubscription
 * @property {GraphQlMockResult['setTokenCookie']} setTokenCookie
 * @property {(operation: string, message: ?) => void} [onSubscription]
 * @property {(operation: string, request: ?) => GraphQLMock} [onQuery]
 */

/**
 * Starts a GraphQL server mock on port 3001 that can also handle subscriptions.
 * It guarantees a single mock per testing browser, and isolated responses per browsing context.
 * It will automatically stops when the browser disconnects.
 *
 * The mocks parameter is an object where keys are GraphQL operation names, and values are either:
 * - a single object, that is the returned data
 * - an array of returned data: each invokation will pick the next data in array, and the last is used for all remaining requests.
 * @param {import('@playwright/test').Page} page - initial page for which GraphQL mock server it set up.
 * @param {GraphQLMocks} [mocks] - mocks for graphQL operations.
 * @return {Promise<GraphQlMockResult>} functions to restore or clear mocks, and to send subscription message.
 */
export async function mockGraphQl(page, mocks) {
  const id = faker.string.uuid()
  const browserContext = page.context()

  if (!server) {
    server = fastify()
    server.register(cors, {
      origin: /.*/,
      methods: ['GET', 'POST'],
      maxAge: 120,
      strictPreflight: true,
      credentials: true
    })
    server.register(staticPlugin, {
      root: gameAssetsFolder,
      prefix: '/games/'
    })
    server.addHook('onResponse', async (request, reply) => {
      log(
        request.id,
        chalk`{greenBright ${reply.statusCode}} ${request.method} ${request.url}`
      )
    })
    server.addHook('onError', async (request, reply, error) => {
      logError(
        request.id,
        chalk`{red ${reply.statusCode}} ${request.method} ${request.url}`,
        error
      )
    })
    server.register(websocket)

    server.register(async function (server) {
      server.get(
        graphQlRoute,
        { websocket: true },
        (connection, { id: reqId }) => {
          log(reqId, `upgrading to WS connection`)
          function sendInWebSocket(/** @type {object} */ payload) {
            serverContext.wsConnection?.socket.send(JSON.stringify(payload))
          }

          connection.socket.on(
            'message',
            async (/** @type {Buffer} */ buffer) => {
              try {
                const message = JSON.parse(buffer.toString())
                log(reqId, `receiving WS message:`, message)
                if (message.type === 'connection_init') {
                  serverContext.wsConnection = connection
                  serverContext.sendToSubscription = payload => {
                    const operation = Object.keys(payload.data)[0]
                    const id = serverContext.subscriptionIds[operation]
                    log(
                      reqId,
                      chalk`sending WS message {blueBright ${id}}:`,
                      payload
                    )
                    sendInWebSocket({ type: 'next', id, payload })
                  }
                  sendInWebSocket({ type: 'connection_ack' })
                } else if (message.type === 'ping') {
                  sendInWebSocket({ type: 'pong' })
                } else if (message.type === 'subscribe') {
                  const operation = message.payload.operationName
                  serverContext.subscriptionIds[operation] = message.id
                  serverContext.onSubscription?.(operation, message)
                }
              } catch (err) {
                logError(
                  chalk`{red can not parse received WS message}: ${
                    /** @type {Error} */ (err).message
                  } \n ${buffer.toString()}`
                )
              }
            }
          )
        }
      )

      server.post(graphQlRoute, async request => {
        const body = /** @type {Record<string, any>} */ (request.body)
        const { operationName: operation } = body
        let responses =
          serverContext.onQuery?.(operation, body) ||
          serverContext.responsesPerOperation.get(operation)
        if (!responses) {
          responses = [null]
          logError(
            request.id,
            chalk`unexpected grapqhQL request {red ${operation}}`
          )
        }
        const rank = serverContext.rankPerOperation.get(operation) ?? 0
        if (rank < responses.length - 1) {
          serverContext.rankPerOperation.set(operation, rank + 1)
        }
        log(
          request.id,
          chalk`returning response #${rank} for {bold ${operation}}:`,
          responses[rank]
        )
        return {
          data: { [operation]: await invokeOrReturn(responses[rank]) }
        }
      })
    })

    browserContext.browser()?.once('disconnected', () => server.close())
    await server.listen({ port: 3001, host: '0.0.0.0' })
    log(
      null,
      chalk`mock server listening to {greenBright ${
        // @ts-ignore address is not null
        server.server.address().port
      }}`
    )
  }

  serverContext = {
    responsesPerOperation: initResponses(mocks),
    rankPerOperation: new Map(),
    subscriptionIds: {},
    sendToSubscription: () => {},
    async setTokenCookie() {
      await page.context().addCookies([
        {
          name: 'token',
          value: id,
          domain: 'localhost:3000',
          path: '/',
          httpOnly: true,
          secure: true
        }
      ])
    }
  }

  return {
    get subscriptionIds() {
      return serverContext.subscriptionIds
    },
    onSubscription: handler => (serverContext.onSubscription = handler),
    onQuery: handler => (serverContext.onQuery = handler),
    sendToSubscription(...args) {
      return serverContext.sendToSubscription(...args)
    },
    get setTokenCookie() {
      return serverContext.setTokenCookie
    }
  }
}

/**
 * @template {function} T
 * @param {T|?} data
 * @returns {ReturnType<T>|?}
 */
function invokeOrReturn(data) {
  return typeof data === 'function' ? data() : data
}

function initResponses(/** @type {GraphQLMocks} */ mocks = {}) {
  /** @type {Map<string, GraphQLMock>} */
  const responsesPerOperation = new Map()
  for (const [operation, responses] of Object.entries(mocks)) {
    responsesPerOperation.set(
      operation,
      Array.isArray(responses) ? responses : [responses]
    )
  }
  return responsesPerOperation
}
