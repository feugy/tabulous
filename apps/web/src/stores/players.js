import { BehaviorSubject } from 'rxjs'
import { initGraphQLGlient, runQuery, runMutation } from './graphql-client'
import * as graphQL from '../graphql'
import { makeLogger } from '../utils'

const logger = makeLogger('players')

const storageKey = 'player'

// we distinguish no value (undefined) and no player (null)
const current$ = new BehaviorSubject()

current$.subscribe(player => {
  const playerData = sessionStorage.getItem(storageKey)
  // skip if we receiving the same player as before
  if (playerData && JSON.parse(playerData)?.id === player?.id) {
    logger.debug({ player, playerData }, `skiping session save`)
    return
  }
  if (player) {
    logger.info({ player }, `saving session`)
    sessionStorage.setItem(storageKey, JSON.stringify(player))
    initGraphQLGlient(player)
  } else if (player === null) {
    logger.info(`clearing session storage`)
    sessionStorage.clear()
    initGraphQLGlient()
  }
})

/**
 * Emits currently authenticated player.
 * @type {Observable<object>}
 */
export const currentPlayer = current$.asObservable()

/**
 * Recovers previous session by reusing data from session storage.
 * @async
 * @returns {object|null} the authenticated player in case of success, or null.
 */
export async function recoverSession() {
  let player = null
  const playerData = sessionStorage.getItem(storageKey)
  if (playerData) {
    try {
      logger.info({ playerData }, `recovering previous session`)
      initGraphQLGlient(JSON.parse(playerData))
      player = await runQuery(graphQL.getCurrentPlayer)
      current$.next(player)
    } catch (error) {
      logger.warn(
        { error, playerData },
        `failed to recover session: ${error.message}`
      )
      await logOut()
    }
  } else {
    await logOut()
  }
  logger.info({ player: current$.value }, `session recovery complete`)
  return player
}

/**
 * Logs a player in.
 * @async
 * @param {string} username - username of the authenticating player.
 * @param {string} password - clear password.
 * @returns {object|null} the authenticated player object, if any.
 */
export async function logIn(username, password) {
  initGraphQLGlient()
  let player = null
  try {
    player = await runMutation(graphQL.logIn, { username, password })
    logger.info(player, `authenticating ${username}`)
  } catch (error) {
    logger.info(
      { error },
      `failed to authenticate ${username}: ${error.message}`
    )
  }
  current$.next(player)
  return player
}

/**
 * Logs current player out.
 * @async
 */
export async function logOut() {
  logger.info(`logging out`)
  current$.next(null)
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
