// @ts-check
import { goto } from '$app/navigation'

import * as graphQL from '../graphql'
import { graphQlUrl, makeLogger } from '../utils'
import { initGraphQlClient, runMutation, runQuery } from './graphql-client'

/** @typedef {import('@tabulous/server/src/services/players.js').Player} BasePlayer */
/** @typedef {import('@tabulous/server/src/graphql/players-resolver').PlayerWithTurnCredentials} PlayerWithTurnCredentials */
/** @typedef {Pick<BasePlayer, 'id'|'username'|'avatar'} Player */

const logger = makeLogger('players')

/**
 * Recovers previous session by calling server.
 * @param {function} fetch - the fetch implementation used to initialize GraphQL client.
 * @param {string} bearer - the Bearer authorization value used to recover session.
 * @returns {Promise<?PlayerWithTurnCredentials>} the recovered session in case of success, or null.
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
    session = await runQuery(/** @type {?} */ (graphQL).getCurrentPlayer)
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
 * @returns {Promise<PlayerWithTurnCredentials>}
 * @throws {Error} when authentication was rejected
 */
export async function logIn(id, password) {
  try {
    const session = await runMutation(/** @type {?} */ (graphQL).logIn, {
      id,
      password
    })
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
 * @returns {Promise<Player[]>} a list (possibly empty) of matching candidates.
 */
export async function searchPlayers(search) {
  logger.info({ search }, `searches for ${search}`)
  return runQuery(/** @type {?} */ (graphQL).searchPlayers, { search })
}

/**
 * Accept terms for the current player.
 * @returns {Promise<Player & Pick<BasePlayer, 'termsAccepted'>>} the current player, updated.
 */
export async function acceptTerms() {
  return runMutation(/** @type {?} */ (graphQL).acceptTerms)
}

/**
 * Updates user details for the current player.
 * @param {string} username - the desired username, if any.
 * @param {string} avatar - the desired avatar, if any.
 * @returns {Promise<Player & Pick<BasePlayer, 'usernameSearchable'>>} the current player, updated.
 */
export async function updateCurrentPlayer(username, avatar) {
  return runMutation(/** @type {?} */ (graphQL).updateCurrentPlayer, {
    username,
    avatar
  })
}

/**
 * Sets whether current player could be found by username
 * @param {boolean} searchable - whether player could be found by username.
 * @returns {Promise<Player & Pick<BasePlayer, 'usernameSearchable'>>} the current player, updated.
 */
export async function setUsernameSearchability(searchable) {
  return runMutation(/** @type {?} */ (graphQL).setUsernameSearchability, {
    searchable
  })
}
