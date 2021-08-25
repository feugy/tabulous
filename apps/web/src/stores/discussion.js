import { BehaviorSubject, merge } from 'rxjs'
import { filter } from 'rxjs/operators'
import { lastMessageReceived, lastMessageSent, send } from './peer-channels'

const resetSymbol = Symbol('reset-chat')

// initialize to ensure an empty thread, instead of undefined
const reset$ = new BehaviorSubject({
  data: { type: 'message', text: resetSymbol }
})

const thread$ = new BehaviorSubject([])

merge(lastMessageSent, lastMessageReceived, reset$)
  .pipe(filter(({ data } = {}) => data?.type === 'message'))
  .subscribe({
    next: ({ data, playerId }) => {
      const messages = thread$.getValue()
      thread$.next(
        data.text === resetSymbol ? [] : [...messages, { ...data, playerId }]
      )
    }
  })

/**
 * @typedef {object} Message a message in the discussion thread:
 * @property {string} playerId - sender id.
 * @property {string} text - message's textual content.
 * @property {number} time - creation timestamp.
 */

/**
 * Discussion thread, as an array of objects.
 * @type {Observable<[Message]>}
 */
export const thread = thread$.asObservable()

/**
 * Sends a message to other players.
 * @param {string} text - message textual content.
 */
export function sendToThread(text) {
  send({ type: 'message', text, time: Date.now() })
}

/**
 * Clears discussion thread.
 */
export function clearThread() {
  reset$.next({ data: { type: 'message', text: resetSymbol } })
}

/**
 * TODO test
 * Loads messages into the discussion thread, clearing previous content.
 * @param {Message[]} messages? - new thread content.
 */
export function loadThread(messages) {
  thread$.next(messages || [])
}

/**
 * Serialize the current discussion so it could be saved on server.
 * @returns {Messages[]} a list (potentially empty) of serialized messages.
 */
export function serializeThread() {
  // exclude other fields from incoming data to make it serializable
  return thread$
    .getValue()
    .map(({ text, time, playerId }) => ({ text, time, playerId }))
}
