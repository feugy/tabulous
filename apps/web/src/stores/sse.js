import { Subject } from 'rxjs'
import { makeLogger } from '../utils'

const logger = makeLogger('sse')

let receiver
const inviteReceived$ = new Subject()

/**
 * Emits game invites received from server
 * @type {Observable<object>}
 */
export const inviteReceived = inviteReceived$.asObservable()

/**
 * Configures an EventSource to receive server-sent events
 * @param {object} player - current player, containing:
 * @param {string}  player.id - player id
 * // TODO url
 */
export function openReceiver(player) {
  closeReceiver()
  logger.info({ player }, 'starting receiving server-sent event')

  receiver = new EventSource(`http://localhost:3001/sse?id=${player.id}`)
  receiver.addEventListener('invite', event => {
    logger.debug({ event }, 'receiving game invite')
    inviteReceived$.next(JSON.stringify(event.data))
  })
}

/**
 * Closes the EventSource (if set)
 */
export function closeReceiver() {
  if (receiver) {
    logger.info('closing server-sent event channel')
    receiver.close()
  }
}
