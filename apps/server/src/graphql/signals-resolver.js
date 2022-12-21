import services from '../services/index.js'
import { isAuthenticated } from './utils.js'

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
    /**
     * Emits signal addressed from current player onto the subscription of another player.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {import('./signals.graphql').SignalInput} args.signal - signal addressed to another player.
     * @param {object} context - graphQL context.
     * @returns {import('./signals.graphql').Signal} signal addressed.
     */
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
    /**
     * Emits signal addressed to the current player
     * Requires valid authentication.
     * @async
     * @param {object} obj - graphQL object.
     * @param {object} args - subscription arguments, including:
     * @param {string} args.gameId - game's id.
     * @param {object} context - graphQL context.
     * @yields {import('./signals.graphql').Signal}
     */
    awaitSignal: {
      subscribe: isAuthenticated(
        async (obj, { gameId }, { player, pubsub }) => {
          const queue = await pubsub.subscribe(`sendSignal-${player.id}`)
          queue.once('close', () => services.setCurrentGameId(player.id, null))
          pubsub.publish({
            topic: `sendSignal-${player.id}`,
            payload: {
              awaitSignal: {
                from: 'server',
                data: JSON.stringify({ type: 'ready' })
              }
            }
          })
          services.setCurrentGameId(player.id, gameId)
          return queue
        }
      )
    }
  }
}
