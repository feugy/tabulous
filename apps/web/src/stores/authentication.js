import { BehaviorSubject } from 'rxjs'
import { closeReceiver, openReceiver } from './sse'
import { initGraphQLGlient, runMutation } from './graphcl-client'
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
    openReceiver(player)
  } else if (player === null) {
    logger.debug(`clearing session storage`)
    sessionStorage.clear()
    initGraphQLGlient()
    closeReceiver()
  }
})

export const currentPlayer = current$.asObservable()

export async function recoverSession() {
  const playerData = sessionStorage.getItem(storageKey)
  if (playerData) {
    try {
      logger.debug({ playerData }, `recovering previous session`)
      await logIn(JSON.parse(playerData).username)
    } catch (error) {
      logger.warn(
        { error, playerData },
        `failed to recover session: ${error.message}`
      )
      await logOut()
    }
    logger.debug({ player: current$.value }, `session recovery complete`)
  }
}

export async function logIn(username) {
  initGraphQLGlient()
  const player = await runMutation(graphQL.logIn, { username })
  logger.info(player, `authenticating ${username}`)
  current$.next(player)
}

export async function logOut() {
  current$.next(null)
}
