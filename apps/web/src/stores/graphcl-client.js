import { createClient } from '@urql/core'
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
  if (player) {
    headers.authorization = `Bearer ${player.id}`
  }

  logger.info({ player }, 'initialize GraphQL client')
  client = createClient({
    url: 'http://localhost:3001/graphql',
    fetchOptions: () => ({ headers })
  })
}

export async function runMutation(query, variables) {
  if (!client) throw new Error('Client is not initialized yet')
  logger.debug({ query, variables }, 'run graphQL mutation')
  const { data } = await client.mutation(query, variables).toPromise()
  logger.debug({ query, variables, data }, 'receiving graphQL mutation results')
  const keys = Object.keys(data || {})
  return keys.length !== 1 ? data : data[keys[0]]
}

export async function runQuery(query, variables, cache = true) {
  if (!client) throw new Error('Client is not initialized yet')
  logger.debug({ query, variables, cache }, 'run graphQL query')
  const { data } = await client
    .query(
      query,
      variables,
      cache ? undefined : { requestPolicy: 'network-only' }
    )
    .toPromise()
  logger.debug(
    { query, variables, cache, data },
    'receiving graphQL query results'
  )
  const keys = Object.keys(data || {})
  return keys.length !== 1 ? data : data[keys[0]]
}
