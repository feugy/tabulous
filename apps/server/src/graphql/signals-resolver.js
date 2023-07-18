// @ts-check
import services from '../services/index.js'
import { makeLogger } from '../utils/index.js'
import { isAuthenticated } from './utils.js'

const logger = makeLogger('signals-resolver')

/** @typedef {import('./utils.js').GraphQLContext} GraphQLContext */

/**
 * @typedef {object} Signal
 * @property {string} from - player id sending this signal
 * @property {string} data - the signal payload.
 */

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
     * @typedef {object} SendSignalArgs
     * @property {object} signal - signal addressed to another player.
     * @property {string} signal.to - player id to which the signal is sent.
     * @property {string} signal.data - the signal payload.
     */

    /**
     * Emits signal addressed from current player onto the subscription of another player.
     * Requires valid authentication.
     * @param {unknown} obj - graphQL object.
     * @param {SendSignalArgs} args - mutation arguments, including:
     * @param {GraphQLContext} context - graphQL context.
     * @returns {Signal} signal addressed.
     */
    sendSignal: isAuthenticated((obj, { signal }, { player, pubsub }) => {
      signal.from = player.id
      const res = {
        topic: `sendSignal-${signal.to}`,
        payload: { awaitSignal: signal }
      }
      pubsub.publish(res)
      logger.trace({ res }, 'sent signal')
      return signal
    })
  },

  Subscription: {
    /**
     * @typedef {object} AwaitSignalArgs
     * @property {string} gameId - game's id.
     */
    awaitSignal: {
      subscribe: isAuthenticated(
        /**
         * Emits signal addressed to the current player
         * Requires valid authentication.
         * @param {unknown} obj - graphQL object.
         * @param {AwaitSignalArgs} args - subscription arguments.
         * @param {GraphQLContext} context - graphQL context.
         * @yields {Signal}
         * @returns {import('./utils.js').PubSubQueue}
         */
        async (obj, { gameId }, { player, pubsub }) => {
          const queue = await pubsub.subscribe(`sendSignal-${player.id}`)
          queue.once('close', () => services.setCurrentGameId(player.id, null))
          const topic = `sendSignal-${player.id}`
          pubsub.publish({
            topic,
            payload: {
              awaitSignal: {
                from: 'server',
                data: JSON.stringify({ type: 'ready' })
              }
            }
          })
          services.setCurrentGameId(player.id, gameId)
          logger.debug({ ctx: { topic } }, 'subscribed to signal updates')
          return queue
        }
      )
    }
  }
}
