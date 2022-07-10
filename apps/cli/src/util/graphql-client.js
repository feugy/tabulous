// @ts-check
import { createClient } from '@urql/core'
import { Agent, fetch, setGlobalDispatcher } from 'undici'
import { loadConfiguration } from './configuration.js'

let client
let fetchOptions

/**
 * Builds or returns the existing graphQL client.
 * @returns {object} graphql client.
 */
export function getGraphQLClient() {
  if (!client) {
    client = initClient({
      ...loadConfiguration(),
      maskTypename: true,
      fetch,
      fetchOptions: () => fetchOptions
    })
  }
  return client
}

function initClient(options) {
  const client = createClient({
    ...options,
    url: `${options.url}/graphql`
  })

  setGlobalDispatcher(
    new Agent({
      connect: {
        rejectUnauthorized: false
      }
    })
  )

  async function runQuery(type, args) {
    const jwt = args.pop()
    fetchOptions = { headers: { cookie: `token=${jwt}` } }
    const { data, error } = await client[type](...args).toPromise()
    if (error) {
      throw error
    }
    return data
  }

  return {
    ...client,
    query: (...args) => runQuery('query', args),
    mutation: (...args) => runQuery('mutation', args)
  }
}
