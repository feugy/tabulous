// @ts-check
const graphQLURL = 'graphql'

/**
 * @typedef {Object.<string, object[]|object>} GraphQLMocks mocks for multiple graphQL operations.
 * Each property name is the operation Name, while values are the returned data, or an array of returned data.
 */

/**
 * @typedef {object} GraphQLMockResult
 * @property {function} restore - removes the mocks.
 * @property {function} clear - clears mock calls as if they were just defined.
 * @property {function} onSubscription - registers a unique callback called when receiving GraphQL subscription.
 * @property {function} sendToSubscription - sends a GraphQL response payload to the subscription.
 */

/**
 * Builds a playwrigth route handler for graphQL responses.
 * For each supported operation, you can provide the returned data, or an array of returned data.
 * When providing an array, returned data is used to serve requests in order, and the last one is used for all remaining requests.
 * @param {import('@playwright/test').Page} page - the page to mock graphql for.
 * @param {GraphQLMocks} mocks - mocks for graphQL operations.
 * @return {Promise<GraphQLMockResult>} functions to restore or clear mocks, and to send subscription message.
 */
export async function mockGraphQL(page, mocks) {
  const responsesPerOperation = initResponses(mocks)
  const rankPerOperation = new Map()

  const handler = (route, request) => {
    const { operationName: operation } = request.postDataJSON()
    let responses = responsesPerOperation.get(operation)
    if (!responses) {
      responses = [null]
      throw new Error(`Unexpected grapqhQL request ${operation}`)
    }
    const rank = rankPerOperation.get(operation) ?? 0
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { [operation]: responses[rank] } })
    })
    if (rank < responses.length - 1) {
      rankPerOperation.set(operation, rank + 1)
    }
  }

  await page.route(graphQLURL, handler)

  return {
    ...(await declareWebSocketMock(page)),
    restore: () => page.unroute(graphQLURL, handler),
    clear: () => rankPerOperation.clear()
  }
}

function initResponses(mocks) {
  const responsesPerOperation = new Map()
  for (const [operation, responses] of Object.entries(mocks)) {
    responsesPerOperation.set(
      operation,
      Array.isArray(responses) ? responses : [responses]
    )
  }
  return responsesPerOperation
}

async function declareWebSocketMock(page) {
  let subscriptionId = null
  let onSubscription = null

  await page.addInitScript({
    content: `
window.WebSocket = class WebSocket {
  static CLOSED = 'CLOSED'
  static CLOSING = 'CLOSING'
  static CONNECTING = 'CONNECTING'
  static OPEN = 'OPEN'

  constructor() {
    window.sendWebSocketMessage = message => {
      this.callHandler('message', message)
    }
    this.readyState = WebSocket.OPEN
    setTimeout(() => this.callHandler('open'), 0)
  }

  send(message) {
    window.handleWebSocketMessage?.(message, this)
  }

  close() {
    this.callHandler('close')
  }

  callHandler(name, detail) {
    const event = new CustomEvent(name, { detail })
    event.data = detail
    this['on' + name]?.(event)
  }
}`
  })

  async function sendWebSocketMessage(message) {
    await page.evaluate(
      // @ts-ignore
      message => window.sendWebSocketMessage(message),
      message
    )
  }

  await page.exposeFunction('handleWebSocketMessage', async rawMessage => {
    const message = JSON.parse(rawMessage)
    if (message.type === 'connection_init') {
      await sendWebSocketMessage({ type: 'connection_ack' })
    } else if (message.type === 'ping') {
      await sendWebSocketMessage({ type: 'pong' })
    } else if (message.type === 'subscribe') {
      subscriptionId = message.id
      onSubscription?.(message)
    }
  })

  return {
    onSubscription: handler => (onSubscription = handler),
    sendToSubscription: async payload => {
      await sendWebSocketMessage({ type: 'next', id: subscriptionId, payload })
    }
  }
}
