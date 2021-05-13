import { BehaviorSubject, merge } from 'rxjs'
import { filter, scan } from 'rxjs/operators'
import { lastMessageReceived, lastMessageSent, send } from './peer-channels'

const resetSymbol = Symbol('reset-chat')

// initialize to ensure an empty thread, instead of undefined
const reset$ = new BehaviorSubject({ message: resetSymbol })

/**
 * @typedef {object} Message
 * @property {string} message - textual message
 */

/**
 * Discussion thread, as an array of objects
 * @type {Observable<[Message]>}
 */
export const thread = merge(lastMessageSent, lastMessageReceived, reset$).pipe(
  filter(({ data } = {}) => data?.message),
  scan(
    (thread, { data, from }) =>
      data.message === resetSymbol ? [] : [...thread, { ...data, from }],
    []
  )
)

/**
 * Sends a message to other players
 * @param {string} message
 */
export function sendToThread(message) {
  send({ message })
}

/**
 * Clears discussion thread
 */
export function clearThread() {
  reset$.next({ data: { message: resetSymbol } })
}
