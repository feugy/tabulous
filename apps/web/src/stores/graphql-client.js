// @ts-check
/**
 * @typedef {import('@urql/core').Client} Client
 * @typedef {import('@urql/core').ClientOptions} ClientOptions
 * @typedef {import('@urql/core').AnyVariables} AnyVariables
 * @typedef {import('@urql/core').CombinedError} CombinedError
 * @typedef {import('graphql-ws').SubscribePayload} SubscribePayload
 */
/**
 * @template D, V
 * @typedef {import('@urql/core').TypedDocumentNode<D, V>} TypedDocumentNode
 */

import {
  cacheExchange,
  createClient,
  fetchExchange,
  subscriptionExchange
} from '@urql/core'
import { createClient as createWSClient } from 'graphql-ws'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { filter, pipe, subscribe } from 'wonka'

import { makeLogger } from '../utils'

const logger = makeLogger('graphql')

/** @type {Client} */
let client

/**
 * Configures GraphQL client.
 * Must be called prior to any graphql query, mutation or subscription.
 * @param {object} options - client options, including:
 * @param {string} options.graphQlUrl - url of the GraphQL endpoint.
 * @param {ClientOptions['fetch']} options.fetch - fetch implementation used to initialize the client.
 * @param {?string} [options.bearer] - data used for authenticating graphQL subscriptions and queries.
 * @param {boolean} [options.subscriptionSupport=true] - whether this client has subscriptions enabled.
 */
export function initGraphQlClient({
  graphQlUrl,
  bearer,
  fetch,
  subscriptionSupport = true
}) {
  const exchanges = [cacheExchange, fetchExchange]
  /** @type {HeadersInit} */
  const headers = {}
  let hasSubscriptionExchange = false
  if (bearer) {
    headers.authorization = bearer
    if (subscriptionSupport) {
      const wsClient = createWSClient({
        url: graphQlUrl.replace('http', 'ws'),
        connectionParams: { bearer }
      })
      hasSubscriptionExchange = true
      exchanges.push(
        subscriptionExchange({
          forwardSubscription: operation => ({
            subscribe: sink => ({
              unsubscribe: wsClient.subscribe(
                /** @type {SubscribePayload} */ (operation),
                sink
              )
            })
          })
        })
      )
    }
  }
  if (!hasSubscriptionExchange) {
    // dummy exchange to avoid warnings
    exchanges.push(
      ref => ops$ =>
        ref.forward(
          filter(operation => operation?.kind !== 'subscription')(ops$)
        )
    )
  }
  logger.info({ bearer }, 'initialize GraphQL client')
  client = createClient({
    url: graphQlUrl,
    fetch,
    fetchOptions: () => ({ headers }),
    maskTypename: true,
    exchanges
  })
  return client
}

/**
 * Runs a graphQL mutation, throwing on errors and extracting data.
 * @template {AnyVariables} Variables, Data
 * @param {TypedDocumentNode<Record<string, Data>, Variables>} query - mutation GraphQL document.
 * @param {Variables} [variables] - mutation variables, when relevant.
 * @returns {Promise<Data>} resulting data.
 * @throws {Error} when client is not initialized
 */
export async function runMutation(query, variables) {
  if (!client) throw new Error('Client is not initialized yet')
  logger.info({ query, variables }, 'run graphQL mutation')
  // @ts-expect-error: 'undefined' could not be assigned to Variable
  const { data, error } = await client.mutation(query, variables).toPromise()
  logger.info(
    { query, variables, data, error },
    'receiving graphQL mutation results'
  )
  processErrors(error)
  const keys = Object.keys(data || {})
  if (!data || keys.length !== 1) {
    throw new Error('graphQL mutation returned no results')
  }
  return data[keys[0]]
}

/**
 * Runs a graphQL query, throwing on errors and extracting data.
 * @template {AnyVariables} Variables, Data
 * @param {TypedDocumentNode<Record<string, Data>, Variables>} query - query GraphQL document.
 * @param {Variables} [variables] - query variables, when relevant.
 * @param {boolean} [cache=true] - whether to cache result or not.
 * @returns {Promise<Data>} resulting data.
 * @throws {Error} when client is not initialized
 */
export async function runQuery(query, variables, cache = true) {
  if (!client) throw new Error('Client is not initialized yet')
  logger.info({ query, variables, cache }, 'run graphQL query')
  const { data, error } = await client
    .query(
      query,
      // @ts-expect-error: 'undefined' could not be assigned to Variable
      variables,
      cache ? undefined : { requestPolicy: 'network-only' }
    )
    .toPromise()
  logger.info(
    { query, variables, cache, data, error },
    'receiving graphQL query results'
  )
  processErrors(error)
  const keys = Object.keys(data || {})
  if (!data || keys.length !== 1) {
    throw new Error('graphQL mutation returned no results')
  }
  return data[keys[0]]
}

/**
 * Starts a subscriptions, returning an observable.
 * @template {AnyVariables} Variables, Data
 * @param {TypedDocumentNode<Record<string, Data>, Variables>} subscription - subscription GraphQL document.
 * @param {Variables} [variables] - subscription variables, when relevant.
 * @returns {Observable<Data>} an observable emitting on received data.
 * @throws {Error} when client is not initialized
 */
export function runSubscription(subscription, variables) {
  if (!client) throw new Error('Client is not initialized yet')
  return new Observable(observer => {
    logger.info({ subscription, variables }, 'starting graphQL subscription')
    const sub = pipe(
      // @ts-expect-error: 'undefined' could not be assigned to Variable
      client.subscription(subscription, variables),
      subscribe(value => observer.next(value))
    )
    return () => {
      logger.info({ subscription, variables }, 'stopping graphQL subscription')
      sub.unsubscribe()
    }
  }).pipe(
    map(({ data, error }) => {
      if (error) {
        logger.error({ error }, `Error received on subscription`)
      }
      const keys = Object.keys(data || {})
      return keys.length !== 1 ? data : data[keys[0]]
    })
  )
}

/**
 * Extract individual errors from GraphQL combined error.
 * @param {CombinedError} [combinedError] - error to analyze.
 * @throws {Error} when receiving network error.
 * @throws {Error} the first graphQL error when receiving some.
 */
function processErrors(/** @type {CombinedError} */ combinedError) {
  if (combinedError?.networkError) {
    throw new Error(combinedError.networkError.message)
  }
  if (combinedError?.graphQLErrors) {
    throw new Error(combinedError.graphQLErrors[0].message)
  }
}
