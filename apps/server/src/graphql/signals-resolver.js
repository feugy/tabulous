import { isAuthenticated } from './utils.js'
import { setPlaying } from '../services/authentication.js'

/**
 * The implemented protocol is:
 *   1. player A is already in game, with an open awaitSignal() subscription
 *   2. player B join game
 *     a. opens awaitSignal() subscription
 *     b. creates a WebRTC peer (initiator) and receives an offer signal
 *     c. send it to player A with sendSignal() mutation
 *   3. player A receives offer through subscription
 *     a. creates a WebRTC peer
 *     b. uses the offer and receives an answer signal
 *     c. send it to player B with sendSignal() mutation
 *   4. player B receives answer through subscription, and uses it
 *   5. their duplex connection is established
 */
export default {
  Mutation: {
    sendSignal: isAuthenticated((obj, { signal }, { player, pubsub }) => {
      signal.from = player.id
      pubsub.publish({
        topic: `sendSignal-${signal.to}`,
        payload: { awaitSignal: signal }
      })
      return signal
    })
  },

  Subscription: {
    awaitSignal: {
      subscribe: isAuthenticated(async (obj, args, { pubsub, player }) => {
        setPlaying(player.id, true)
        const queue = await pubsub.subscribe(`sendSignal-${player.id}`)
        queue.once('close', () => setPlaying(player.id, false))
        return queue
      })
    }
  }
}
