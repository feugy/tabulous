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

let server = null
// Store the current server context, that is, the mocks for current test.
// It prevents running tests in paralle, but it's acceptable, because parrallel test would be in
// different processes, and sharing the same mock server would be impossible.
let serverContext = null

function log(reqId, ...args) {
  const now = new Date()
  debug &&
    console.log(
      chalk`{dim ${now.toLocaleTimeString()}.${now.getMilliseconds()}}`,
      chalk`{blueBright mock-server ${reqId ? `[${reqId}] ` : ''}}-`,
      ...args
    )
}

function logError(reqId, ...args) {
  const now = new Date()
  console.log(
    chalk`{dim ${now.toLocaleTimeString()}.${now.getMilliseconds()}}`,
    chalk`{red.bold mock-server [${reqId}]} -`,
    ...args
  )
}

/**
 * @typedef {Object.<string, object[]|object>} GraphQLMocks mocks for multiple graphQL operations.
 * Each property name is the operation Name, while values are the returned data, or an array of returned data.
 */

/**
 * @typedef {object} GraphQlMockResult
 * @property {Record<string, string>} subscriptionIds - GaphQL subscription ids by their operation name.
 * @property {(operation: string, message: object) => void} onSubscription - registers a unique callback called when receiving GraphQL subscription.
 * @property {(operation: string, request: object) => undefined|object[]|object} onQuery - registers a unique callback called when receiving GraphQL queries (and mutations).
 *                                                                                         Can be used to override predefined responses
 * @property {(payload: object) => void} sendToSubscription - sends a GraphQL response payload to the subscription.
 * @property {() => void} setTokenCookie - sets token cookie so SvelteKit server can issue requests to the mocked server.
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
          function sendInWebSocket(payload) {
            serverContext.wsConnection?.socket.send(JSON.stringify(payload))
          }

          connection.socket.on('message', async buffer => {
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
                  err.message
                } \n ${buffer.toString()}`
              )
            }
          })
        }
      )

      server.post(graphQlRoute, async request => {
        // @ts-ignore request.body is not typed
        const { operationName: operation } = request.body
        let responses =
          serverContext.onQuery?.(operation, request.body) ||
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
    subscriptionIds: [],
    wsConnection: null,
    onSubscription: null,
    onQuery: null,
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

function invokeOrReturn(data) {
  return typeof data === 'function' ? data() : data
}

function initResponses(mocks = {}) {
  const responsesPerOperation = new Map()
  for (const [operation, responses] of Object.entries(mocks)) {
    responsesPerOperation.set(
      operation,
      Array.isArray(responses) ? responses : [responses]
    )
  }
  return responsesPerOperation
}
