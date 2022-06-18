import { browser } from '$app/env'
import { goto } from '$app/navigation'
import { BehaviorSubject, map } from 'rxjs'
import { initGraphQLGlient, runQuery, runMutation } from './graphql-client'
import * as graphQL from '../graphql'
import { makeLogger } from '../utils'

const logger = makeLogger('players')

const storageKey = 'session'

// we distinguish no value (undefined) and no player (null)
const authenticationData$ = new BehaviorSubject()

if (browser) {
  authenticationData$.subscribe(session => {
    const sessionData = sessionStorage.getItem(storageKey)
    // skip if we receiving the same player as before
    if (
      sessionData &&
      JSON.parse(sessionData)?.player?.id === session?.player?.id
    ) {
      logger.debug({ session, sessionData }, `skipping session save`)
      return
    }
    if (session) {
      logger.info({ session }, `saving session`)
      sessionStorage.setItem(storageKey, JSON.stringify(session))
      initGraphQLGlient(session.player)
    } else if (session === null) {
      logger.info(`clearing session storage`)
      sessionStorage.clear()
      initGraphQLGlient()
    }
  })
}

/**
 * Emits currently authenticated player.
 * @type {Observable<import('../graphql').Player>}
 */
export const currentPlayer = authenticationData$.pipe(
  map(data => data?.player ?? null)
)

/**
 * Emits turn credentials obtained during authentication
 * @type {Observable<import('../graphql').TurnCredentials>}
 */
export const turnCredentials = authenticationData$.pipe(
  map(data => data?.turnCredentials ?? null)
)

/**
 * Recovers previous session by reusing data from session storage.
 * @async
 * @returns {object|null} the authenticated player in case of success, or null.
 */
export async function recoverSession() {
  let player = null
  const sessionData = sessionStorage.getItem(storageKey)
  if (sessionData) {
    try {
      logger.info({ sessionData }, `recovering previous session`)
      const session = JSON.parse(sessionData)
      initGraphQLGlient(session.player)
      player = await runQuery(graphQL.getCurrentPlayer)
      authenticationData$.next({ ...session, player })
    } catch (error) {
      logger.warn(
        { error, playerData: sessionData },
        `failed to recover session: ${error.message}`
      )
      await logOut()
    }
  } else {
    await logOut()
  }
  logger.info(
    { session: authenticationData$.value },
    `session recovery complete`
  )
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
  let session = null
  try {
    session = await runMutation(graphQL.logIn, { username, password })
    logger.info({ session }, `authenticating ${username}`)
  } catch (error) {
    logger.info(
      { error },
      `failed to authenticate ${username}: ${error.message}`
    )
  }
  authenticationData$.next(session)
  return session?.player ?? null
}

/**
 * Logs current player out.
 * @async
 */
export async function logOut() {
  logger.info(`logging out`)
  authenticationData$.next(null)
  goto('/login')
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
