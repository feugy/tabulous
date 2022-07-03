import { browser } from '$app/env'
import { goto } from '$app/navigation'
import { BehaviorSubject, map } from 'rxjs'
import { initGraphQLGlient, runQuery, runMutation } from './graphql-client'
import * as graphQL from '../graphql'
import { makeLogger } from '../utils'

const logger = makeLogger('players')

const storageKey = 'session'

// we distinguish no value (undefined) and no player (null)
const session$ = new BehaviorSubject()

if (browser) {
  session$.subscribe(session => {
    const sessionData = sessionStorage.getItem(storageKey)
    initGraphQLGlient(session?.token)
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
    } else if (session === null) {
      logger.info(`clearing session storage`)
      sessionStorage.clear()
    }
  })
}

/**
 * Emits currently authenticated player.
 * @type {Observable<import('../graphql').Player>}
 */
export const currentPlayer = session$.pipe(map(data => data?.player ?? null))

/**
 * Emits turn credentials obtained during authentication
 * @type {Observable<import('../graphql').TurnCredentials>}
 */
export const turnCredentials = session$.pipe(
  map(data => data?.turnCredentials ?? null)
)

/**
 * Recovers previous session by calling server (leverage http-only cookie).
 * @async
 * @returns {object|null} the recovered session in case of success, or null.
 */
export async function recoverSession() {
  let session = null
  try {
    logger.info(`recovering previous session`)
    initGraphQLGlient()
    session = await runQuery(graphQL.getCurrentPlayer)
    session$.next(session)
  } catch (error) {
    logger.warn({ error }, `failed to recover session: ${error.message}`)
    await logOut()
  }
  logger.info({ session }, `session recovery complete`)
  return session
}

/**
 * Logs a player in with username/password method.
 * Populates currentPlayer and turnCredentials stores.
 * @async
 * @param {string} username - username of the authenticating player.
 * @param {string} password - clear password.
 * @throws {Error} when authentication was rejected
 */
export async function logIn(username, password) {
  let session = null
  let authenticationError
  try {
    session = await runMutation(graphQL.logIn, { username, password })
    logger.info({ session }, `authenticating ${username}`)
  } catch (error) {
    logger.info(
      { error },
      `failed to authenticate ${username}: ${error.message}`
    )
    authenticationError = error
  }
  session$.next(session)
  if (authenticationError) {
    throw authenticationError
  }
}

/**
 * Logs current player out.
 * @async
 */
export async function logOut() {
  logger.info(`logging out`)
  await runMutation(graphQL.logOut)
  session$.next(null)
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
