import { merge } from 'rxjs'
import { filter, scan } from 'rxjs/operators'
import { lastMessageReceived, lastMessageSent, send } from './communication'

export const chat = merge(lastMessageSent, lastMessageReceived).pipe(
  filter(data => data.message),
  scan((thread, message) => [...thread, message], [])
)

export function sendMessage(message) {
  send({ message })
}
