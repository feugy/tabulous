import { BehaviorSubject } from 'rxjs'
import { initCommunication } from './communication'
import { makeLogger } from '../utils'

const logger = makeLogger('authentication')

const storageKey = 'user'

const current$ = new BehaviorSubject()

current$.subscribe(user => {
  if (user) {
    logger.debug({ user }, `saving session`)
    sessionStorage.setItem(storageKey, JSON.stringify(user))
  } else if (user === null) {
    logger.debug(`clearing session storage`)
    sessionStorage.clear()
  }
})

export const currentUser = current$.asObservable()

export async function recoverSession() {
  const userData = sessionStorage.getItem(storageKey)
  try {
    logger.debug({ userData }, `recovering previous session`)
    await logIn(JSON.parse(userData))
  } catch (error) {
    logger.warn(
      { error, userData },
      `failed to recover session: ${error.message}`
    )
    await logOut()
  }
  logger.debug({ user: current$.value }, `session recovery complete`)
}

export async function logIn({ username, id }) {
  id = id || Math.floor(Math.random() * 100000).toString()
  logger.info({ id, username }, `authenticating ${username}`)
  current$.next({ username, id })
  await initCommunication(id)
}

export async function logOut() {
  current$.next(null)
}
