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
 * Configures GraphQL client, potentially for current player
 * @param {object} player - current player, if available, containing:
 * @param {string}  player.id - player id
 * // TODO url
 */
export function initGraphQLGlient(player) {
  const headers = {}
  const exchanges = [...defaultExchanges]
  if (player) {
    headers.authorization = `Bearer ${player.id}`
    const wsClient = new createWSClient({
      url: `${location.origin.replace('http', 'ws')}/graphql`,
      connectionParams: { bearer: player.id }
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

  logger.info({ player }, 'initialize GraphQL client')
  client = createClient({
    url: '/graphql',
    fetchOptions: () => ({ headers }),
    maskTypename: true,
    exchanges
  })
}

export async function runMutation(query, variables) {
  if (!client) throw new Error('Client is not initialized yet')
  logger.info({ query, variables }, 'run graphQL mutation')
  const { data } = await client
    .mutation(query, variables, { requestPolicy: 'network-only' })
    .toPromise()
  logger.info({ query, variables, data }, 'receiving graphQL mutation results')
  const keys = Object.keys(data || {})
  return keys.length !== 1 ? data : data[keys[0]]
}

export async function runQuery(query, variables, cache = true) {
  if (!client) throw new Error('Client is not initialized yet')
  logger.info({ query, variables, cache }, 'run graphQL query')
  const { data } = await client
    .query(
      query,
      variables,
      cache ? undefined : { requestPolicy: 'network-only' }
    )
    .toPromise()
  logger.info(
    { query, variables, cache, data },
    'receiving graphQL query results'
  )
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
