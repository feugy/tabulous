// @ts-check
import services from '../services/index.js'
import { makeLogger } from '../utils/index.js'
import { isAuthenticated } from './utils.js'

const logger = makeLogger('signals-resolver')

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
    sendSignal: isAuthenticated(
      /**
       * Emits signal addressed from current player onto the subscription of another player.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {import('.').SendSignalArgs} args - mutation arguments, including:
       * @param {import('./utils').GraphQLContext} context - graphQL context.
       * @returns signal addressed.
       */
      (obj, { signal }, { player, pubsub }) => {
        /** @type {import('.').Signal} */
        const result = {
          ...signal,
          from: player.id
        }
        const res = {
          topic: `sendSignal-${signal.to}`,
          payload: { awaitSignal: result }
        }
        pubsub.publish(res)
        logger.trace({ res }, 'sent signal')
        return result
      }
    )
  },

  Subscription: {
    awaitSignal: {
      subscribe: isAuthenticated(
        /**
         * Emits signal addressed to the current player
         * Requires valid authentication.
         * @param {unknown} obj - graphQL object.
         * @param {import('.').AwaitSignalArgs} args - subscription arguments.
         * @param {import('./utils').GraphQLContext} context - graphQL context.
         * @yields {import('.').Signal}
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
