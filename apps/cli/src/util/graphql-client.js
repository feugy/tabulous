// @ts-check
/**
 * @typedef {import('@urql/core').Client} UrqlClient
 * @typedef {import('@urql/core').ClientOptions} UrqlClientOptions
 */

import { cacheExchange, createClient, fetchExchange } from '@urql/core'
import { Agent, fetch, setGlobalDispatcher } from 'undici'

import { loadConfiguration } from './configuration.js'

/** @typedef {Parameters<UrqlClient['query']>[0]} Query */

/** @typedef {Parameters<UrqlClient['query']>[1]} Variables */

/** @typedef {<T>(query: Query, variablesOrJwt: Variables|string, jwt?: string) => Promise<T>} RequestSignature */

/**
 * @typedef {object} CustomClient
 * @property {RequestSignature} query - runs a GraphQL query with pre-defined JWT, throwing received errors.
 * @property {RequestSignature} mutation - runs a GraphQL query with pre-defined JWT, throwing received errors.
 */

/** @typedef {Omit<UrqlClient, 'query'|'mutation'> & CustomClient} Client */

/** @type {?Client} */
let client
/** @type {RequestInit} */
let fetchOptions

/**
 * Builds or returns the existing graphQL client.
 * @returns {Client} graphql client.
 */
export function getGraphQLClient() {
  if (!client) {
    client = initClient({
      ...loadConfiguration(),
      maskTypename: true,
      // @ts-expect-error: undici types are not 100% compatible with @urql expectations
      fetch,
      fetchOptions: () => fetchOptions,
      exchanges: [cacheExchange, fetchExchange]
    })
  }
  return client
}

/**
 * @param {UrqlClientOptions} options - GraphQL client options.
 * @returns {Client} initialized client.
 */
function initClient(options) {
  const client = createClient(options)

  setGlobalDispatcher(
    new Agent({
      connect: {
        rejectUnauthorized: false
      }
    })
  )

  /**
   * @param {'query'|'mutation'} type
   * @param {Parameters<RequestSignature>} args
   * @returns {Promise<?>}
   */
  async function runQuery(type, [query, variablesOrJwt, jwt]) {
    const token = jwt ?? variablesOrJwt
    fetchOptions = { headers: { authorization: `Bearer ${token}` } }
    const { data, error } = await client[type](
      query,
      jwt ? /** @type {Variables} */ (variablesOrJwt) : undefined
    ).toPromise()
    if (error) {
      throw error
    }
    return data
  }

  return {
    ...client,
    query: (/** @type {Parameters<RequestSignature>} */ ...args) =>
      runQuery('query', args),
    mutation: (/** @type {Parameters<RequestSignature>} */ ...args) =>
      runQuery('mutation', args)
  }
}
