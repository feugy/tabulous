// @ts-check
/**
 * @typedef {import('@tabulous/server/src/graphql').Message} Message
 * @typedef {import('@src/stores/peer-channels').Message} WebRTCMessage
 */

import { BehaviorSubject, merge } from 'rxjs'
import { filter } from 'rxjs/operators'

import { lastMessageReceived, lastMessageSent, send } from './peer-channels'

const resetSymbol = Symbol('reset-chat')
const resetMessage = /** @type {WebRTCMessage} */ ({
  data: { type: 'message', text: resetSymbol }
})

// initialize to ensure an empty thread, instead of undefined
const reset$ = new BehaviorSubject(resetMessage)

const thread$ = new BehaviorSubject(/** @type {Message[]} */ ([]))

merge(lastMessageSent, lastMessageReceived, reset$)
  .pipe(filter(message => message?.data?.type === 'message'))
  .subscribe({
    next: ({ data, playerId }) => {
      const messages = thread$.getValue()
      thread$.next(
        data.text === resetSymbol ? [] : [...messages, { ...data, playerId }]
      )
    }
  })

/**
 * Discussion thread, as an array of objects.
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
  reset$.next(resetMessage)
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
 * @returns {Message[]} a list (potentially empty) of serialized messages.
 */
export function serializeThread() {
  // exclude other fields from incoming data to make it serializable
  return thread$
    .getValue()
    .map(({ text, time, playerId }) => ({ text, time, playerId }))
}
