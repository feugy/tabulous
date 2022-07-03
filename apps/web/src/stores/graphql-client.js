import {
  createClient,
  defaultExchanges,
  subscriptionExchange
} from '@urql/core'
import { createClient as createWSClient } from 'graphql-ws'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { pipe, subscribe } from 'wonka'
import { makeLogger } from '../utils'

const logger = makeLogger('graphql')

let client

/**
 * Configures GraphQL client.
 * Must be called prior to any graphql query, mutation or subscription.
 * @param {string} bearer - data used for authenticating graphQL subscriptions
 */
export function initGraphQLGlient(bearer) {
  const exchanges = [...defaultExchanges]
  if (bearer) {
    const wsClient = new createWSClient({
      url: `${location.origin.replace('http', 'ws')}/graphql`,
      connectionParams: { bearer }
    })
    exchanges.push(
      subscriptionExchange({
        forwardSubscription: operation => ({
          subscribe: sink => ({
            unsubscribe: wsClient.subscribe(operation, sink)
          })
        })
      })
    )
  }

  logger.info({ bearer }, 'initialize GraphQL client')
  client = createClient({ url: '/graphql', maskTypename: true, exchanges })
}

export async function runMutation(query, variables) {
  if (!client) throw new Error('Client is not initialized yet')
  logger.info({ query, variables }, 'run graphQL mutation')
  const { data, error } = await client.mutation(query, variables).toPromise()
  logger.info(
    { query, variables, data, error },
    'receiving graphQL mutation results'
  )
  processErrors(error)
  const keys = Object.keys(data || {})
  return keys.length !== 1 ? data : data[keys[0]]
}

export async function runQuery(query, variables, cache = true) {
  if (!client) throw new Error('Client is not initialized yet')
  logger.info({ query, variables, cache }, 'run graphQL query')
  const { data, error } = await client
    .query(
      query,
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
  return keys.length !== 1 ? data : data[keys[0]]
}

/**
 * Starts a subscriptions, returning an observable.
 * @param {import('graphql').DocumentNode} subscription - the ran subscription.
 * @param {object} variables? - variables passed to the supscription, if any.
 * @returns {Observable} an observable which emits every time an updates is received.
 */
export function runSubscription(subscription, variables) {
  if (!client) throw new Error('Client is not initialized yet')
  return new Observable(observer => {
    logger.info({ subscription, variables }, 'starting graphQL subscription')
    const sub = pipe(
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

function processErrors(combinedError) {
  if (combinedError?.networkError) {
    throw new Error(combinedError.networkError)
  }
  if (combinedError?.graphQLErrors) {
    throw new Error(combinedError.graphQLErrors[0].message)
  }
}
