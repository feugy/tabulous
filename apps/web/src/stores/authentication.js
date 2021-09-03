import { BehaviorSubject } from 'rxjs'
import { initGraphQLGlient, runMutation } from './graphql-client'
import * as graphQL from '../graphql'
import { makeLogger } from '../utils'

const logger = makeLogger('authentication')

const storageKey = 'player'

const current$ = new BehaviorSubject()

current$.subscribe(player => {
  if (player) {
    logger.debug({ player }, `saving session`)
    sessionStorage.setItem(storageKey, JSON.stringify(player))
    initGraphQLGlient(player)
  } else if (player === null) {
    logger.debug(`clearing session storage`)
    sessionStorage.clear()
    initGraphQLGlient()
  }
})

/**
 * Emits currently authenticated player
 * @type {Observable<object>}
 */
export const currentPlayer = current$.asObservable()

/**
 * Recovers previous session by reusing data from session storage.
 * @async
 * @returns {object|null} the authenticated player in case of success, or null
 */
export async function recoverSession() {
  const playerData = sessionStorage.getItem(storageKey)
  if (playerData) {
    let player = null
    try {
      logger.debug({ playerData }, `recovering previous session`)
      player = await logIn(JSON.parse(playerData).username)
    } catch (error) {
      logger.warn(
        { error, playerData },
        `failed to recover session: ${error.message}`
      )
      await logOut()
    }
    logger.debug({ player: current$.value }, `session recovery complete`)
    return player
  }
}

/**
 * Logs a player in.
 * @async
 * @param {string} username - username of the authenticating player
 * @param {string} password - clear password
 * @returns {object} the authenticated player object
 */
export async function logIn(username, password) {
  initGraphQLGlient()
  const player = await runMutation(graphQL.logIn, { username, password })
  logger.info(player, `authenticating ${username}`)
  current$.next(player)
  return player
}

/**
 * Logs current player out.
 * @async
 */
export async function logOut() {
  current$.next(null)
}
