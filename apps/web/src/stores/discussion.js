import { BehaviorSubject, merge } from 'rxjs'
import { filter, scan } from 'rxjs/operators'
import { lastMessageReceived, lastMessageSent, send } from './communication'

const resetSymbol = Symbol('reset-chat')

// initialize to ensure an empty thread, instead of undefined
const reset$ = new BehaviorSubject({ message: resetSymbol })

export const thread = merge(lastMessageSent, lastMessageReceived, reset$).pipe(
  filter(data => data?.message),
  scan(
    (thread, data) => (data.message === resetSymbol ? [] : [...thread, data]),
    []
  )
)

export function sendToThread(message) {
  send({ message })
}

export function clearThread() {
  reset$.next({ message: resetSymbol })
}
