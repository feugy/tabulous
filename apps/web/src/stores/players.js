import { goto } from '$app/navigation'
import { initGraphQlClient, runQuery, runMutation } from './graphql-client'
import * as graphQL from '../graphql'
import { makeLogger, graphQlUrl } from '../utils'

const logger = makeLogger('players')

/**
 * Recovers previous session by calling server.
 * @async
 * @param {function} fetch - the fetch implementation used to initialize GraphQL client.
 * @param {string} bearer - the Bearer authorization value used to recover session.
 * @returns {object|null} the recovered session in case of success, or null.
 */
export async function recoverSession(fetch, bearer) {
  let session = null
  try {
    logger.info(`recovering previous session`)
    initGraphQlClient({
      graphQlUrl,
      fetch,
      bearer,
      subscriptionSupport: false
    })
    session = await runQuery(graphQL.getCurrentPlayer)
  } catch (error) {
    logger.debug({ error }, `failed to recover session: ${error.message}`)
  }
  logger.info({ session }, `session recovery complete`)
  return session
}

/**
 * Logs a player in with id/password method.
 * @async
 * @param {string} id - the authenticating player id.
 * @param {string} password - clear password.
 * @throws {Error} when authentication was rejected
 */
export async function logIn(id, password) {
  try {
    const session = await runMutation(graphQL.logIn, { id, password })
    logger.info({ session }, `authenticating ${id}`)
    return session
  } catch (error) {
    logger.info({ error }, `failed to authenticate ${id}: ${error.message}`)
    throw error
  }
}

/**
 * Navigates to the logout url which clear cookie and redirect to home page.
 * @async
 */
export async function logOut() {
  logger.info(`logging out`)
  return goto('/logout')
}

/**
 * Searches for player whom username contains the searched text.
 * @async
 * @param {string} search - searched text.
 * @returns {object[]} a list (possibly empty) of matching candidates.
 */
export async function searchPlayers(search) {
  logger.info({ search }, `searches for ${search}`)
  return runQuery(graphQL.searchPlayers, { search })
}
