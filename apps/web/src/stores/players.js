// @ts-check
/**
 * @typedef {import('@src/graphql').PlayerFragment} PlayerFragment
 * @typedef {import('@src/graphql').PlayerWithSearchable} PlayerWithSearchable
 * @typedef {import('@src/graphql').PlayerWithTurnCredentials} PlayerWithTurnCredentials
 * @typedef {import('@urql/core').ClientOptions} ClientOptions
 */
/**
 * @template T
 * @typedef {import('@src/types').DeepRequired<T>} DeepRequired
 */

import * as graphQL from '@src/graphql'

import { goto } from '$app/navigation'

import { graphQlUrl, makeLogger } from '../utils'
import { initGraphQlClient, runMutation, runQuery } from './graphql-client'

const logger = makeLogger('players')

/**
 * Recovers previous session by calling server.
 * @param {ClientOptions['fetch']} fetch - the fetch implementation used to initialize GraphQL client.
 * @param {string} bearer - the Bearer authorization value used to recover session.
 * @returns {Promise<?DeepRequired<PlayerWithTurnCredentials>>} the recovered session in case of success, or null.
 */
export async function recoverSession(fetch, bearer) {
  /** @type {?DeepRequired<PlayerWithTurnCredentials>} */
  let session = null
  try {
    logger.info(`recovering previous session`)
    initGraphQlClient({
      graphQlUrl,
      fetch,
      bearer,
      subscriptionSupport: false
    })
    session = /** @type {DeepRequired<PlayerWithTurnCredentials>} */ (
      await runQuery(graphQL.getCurrentPlayer)
    )
  } catch (error) {
    logger.debug(
      { error },
      `failed to recover session: ${/** @type {Error} */ (error).message}`
    )
  }
  logger.info({ session }, `session recovery complete`)
  return session
}

/**
 * Logs a player in with id/password method.
 * @param {string} id - the authenticating player id.
 * @param {string} password - clear password.
 * @returns {Promise<DeepRequired<PlayerWithTurnCredentials>>}
 * @throws {Error} when authentication was rejected
 */
export async function logIn(id, password) {
  try {
    const session = /** @type {DeepRequired<PlayerWithTurnCredentials>} */ (
      await runMutation(graphQL.logIn, {
        id,
        password
      })
    )
    logger.info({ session }, `authenticating ${id}`)
    return session
  } catch (error) {
    logger.info(
      { error },
      `failed to authenticate ${id}: ${/** @type {Error} */ (error).message}`
    )
    throw error
  }
}

/**
 * Navigates to the logout url which clear cookie and redirect to home page.
 * @returns {Promise<void>}
 */
export async function logOut() {
  logger.info(`logging out`)
  return goto('/logout')
}

/**
 * Searches for player whom username contains the searched text.
 * @param {string} search - searched text.
 * @returns {Promise<PlayerFragment[]>} a list (possibly empty) of matching candidates.
 */
export async function searchPlayers(search) {
  logger.info({ search }, `searches for ${search}`)
  return runQuery(graphQL.searchPlayers, { search })
}

/**
 * Accept terms for the current player.
 * @returns {Promise<PlayerFragment & { termsAccepted?: boolean }>} the current player, updated.
 */
export async function acceptTerms() {
  return runMutation(graphQL.acceptTerms)
}

/**
 * Updates user details for the current player.
 * @param {string} username - the desired username, if any.
 * @param {string} [avatar] - the desired avatar, if any.
 * @returns {Promise<PlayerWithSearchable>} the current player, updated.
 */
export async function updateCurrentPlayer(username, avatar) {
  return runMutation(graphQL.updateCurrentPlayer, {
    username,
    avatar
  })
}

/**
 * Sets whether current player could be found by username
 * @param {boolean} searchable - whether player could be found by username.
 * @returns {Promise<PlayerWithSearchable>} the current player, updated.
 */
export async function setUsernameSearchability(searchable) {
  return runMutation(graphQL.setUsernameSearchability, {
    searchable
  })
}
