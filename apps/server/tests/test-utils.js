import { readFileSync, writeFileSync } from 'node:fs'

import { createSigner } from 'fast-jwt'
import Redis from 'ioredis'
import { vi } from 'vitest'
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

/**
 * Monkey patch all methods, replacing them with vi mocks.
 * Does not modify getters, setters and plain attributes
 * @param {object} object - hash containing all service methods.
 * @returns {function} revert patching when called.
 */
export function mockMethods(object) {
  const original = { ...object }
  for (const method in object) {
    if (typeof object[method] === 'function') {
      object[method] = vi.fn()
    }
  }
  return () => Object.assign(object, original)
}

/**
 * Performs a deep clone, using JSON parse and stringify
 * This is a slow, destructive (functions, Date and Regex are lost) method, only suitable in tests
 * @param {object} object - cloned object
 * @returns {object} a clone
 */
export function cloneAsJSON(object) {
  return JSON.parse(JSON.stringify(object))
}

/**
 * For testing purposes, signs a player id in a valid JWT.
 * @param {string} playerId - signed player id.
 * @param {string} key - key used to sign the token.
 * @returns {string} jwt that can be used as a token.
 */
export function signToken(playerId, key) {
  return createSigner({ key })({ id: playerId })
}

const lastDBFile = '.last-db'

/**
 * Returns an URL a new Redis database, between 1 and 15.
 * @returns {string} url to the redis database.
 */
export function getRedisTestUrl() {
  let lastDatabase = 0
  try {
    lastDatabase = parseInt(readFileSync(lastDBFile, 'utf-8'))
  } catch {
    lastDatabase = 0
  }
  lastDatabase = lastDatabase % 15 === 0 ? 1 : lastDatabase + 1
  writeFileSync(lastDBFile, lastDatabase.toString())
  return `redis://localhost:6379/${lastDatabase}`
}

/**
 * Synchronously removes all keys from a given Redis database.
 * @param {string} url to the redis database.
 * @returns {Promise<void>} resolves when done.
 */
export async function clearDatabase(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('you forgot to specificy a database url')
  }
  await new Redis(databaseUrl).flushdb()
}
