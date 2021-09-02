import WebSocket from 'ws'

/**
 * Opens a web socket to run GraphQL subscriptions.
 * @async
 * @param {import('fastify').FastifyInstance} app - fastify instance to connect to.
 * @returns {WebSocket} connected web socket.
 */
export function openGraphQLWebSocket(app) {
  const ws = new WebSocket(
    `ws://localhost:${app.server.address().port}/graphql`,
    'graphql-ws'
  )
  return new Promise(resolve => ws.once('open', () => resolve(ws)))
}

/**
 * Waits for the web socket to receive a message.
 * You can specify condition on the expected message
 * @async
 * @param {WebSocket} ws - websocket client.
 * @param {function} matcher - a function that takes receive data and returns a boolean.
 * @returns {object} message returned, as an object.
 */
export function waitOnMessage(ws, matcher = () => true) {
  return new Promise(resolve => {
    function handleMessage(buffer) {
      const data = JSON.parse(buffer.toString())
      if (matcher(data)) {
        ws.removeListener('message', handleMessage)
        resolve(data)
      }
    }
    ws.on('message', handleMessage)
  })
}

/**
 * Starts listening on a GraphQL subscription.
 * @async
 * @param {WebSocket} ws - websocket client.
 * @param {string} query - GraphQL subscription query.
 * @param {string} bearer - data sent as bearer on connection.
 * @param {number} [id=1] - subscription (unique) id.
 * @returns {object} connection acknowledge message.
 */
export function startSubscription(ws, query, bearer, id = 1) {
  ws.send(JSON.stringify({ type: 'connection_init', payload: { bearer } }))
  ws.send(JSON.stringify({ id, type: 'start', payload: { query } }))
  return waitOnMessage(ws, data => data.type === 'connection_ack')
}

/**
 * Stops listening to a GraphQL subscription.
 * @async
 * @param {WebSocket} ws - websocket client.
 * @param {number} [id=1] - subscription (unique) id.
 * @returns {object} connection completion message.
 */
export function stopSubscription(ws, id = 1) {
  ws.send(JSON.stringify({ id, type: 'stop' }))
  return waitOnMessage(ws)
}

/**
 * Turns a plain JS Object into a GraphQL compliant argument,
 * that can be used in a GraphQL query string.
 * @param {object} object - the input object.
 * @returns {string} its representation as a GraphQL argument.
 */
export function toGraphQLArg(object) {
  return JSON.stringify(object).replace(/"(\w+)":/g, '$1:')
}
