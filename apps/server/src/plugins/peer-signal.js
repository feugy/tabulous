import fp from 'fastify-plugin'
import { setPlaying } from '../services/index.js'
import { getAuthenticatedPlayer } from './utils.js'

/**
 * @typedef {object} PeerSignalOptions Peer signaling plugin options, including:
 * @property {string} path - the websocket endpoint path.
 */

/**
 * Registers routes to implement a WebRTC signaling server, based on WebSockets.
 * It depends on fastify-websocket plugin.
 * The implemented protocol is:
 *   1. player A is already in game, with an open WebSocket connection
 *   2. player B join game
 *     a. opens a WebSocket connection
 *     b. creates a WebRTC peer (initiator) and receives an offer signal
 *     c. send it throught WebSocket to player A
 *   3. player A receives offer through WebSocket
 *     a. creates a WebRTC peer
 *     b. uses the offer and receives an answer signal
 *     c. send it throught WebSocket to player B
 *   4. player B receives answer through WebSocket, and uses it
 *   5. their duplex connection is established
 *
 * @param {import('fastify').FastifyInstance} app - a fastify application.
 * @param {PeerSignalOptions} opts - plugin's options.
 */
async function peerSignal(app, opts) {
  const socketByPlayerId = new Map()

  app.get(
    opts.path,
    { websocket: true },
    (connection, { log, query: { bearer } }) => {
      let player

      getAuthenticatedPlayer(bearer).then(data => {
        if (data) {
          player = data
          log.info({ player }, 'opening websocket')
          setPlaying(player.id, true)
          socketByPlayerId.set(player.id, connection.socket)
        } else {
          log.warn('closing playerless websocket')
          connection.socket.terminate()
        }
      })

      connection.socket.on('message', async rawMessage => {
        try {
          const message = JSON.parse(rawMessage)
          log.debug({ message }, 'receiveing message')

          const type = message?.type
          if (type === 'offer' || type === 'answer') {
            const playerId = message.to?.id
            const socket = socketByPlayerId.get(playerId)
            if (socket) {
              log.debug(
                message,
                `sending ${type} from ${message.from?.id} to ${playerId}`
              )
              socket.send(JSON.stringify(message))
            } else {
              log.warn(message, `no socket found for player ${playerId}`)
            }
          }
        } catch (error) {
          log.error(
            { error, rawMessage },
            `failed to process incoming message: ${error.message}`
          )
        }
      })

      connection.socket.on('close', () => {
        if (player) {
          log.info(
            { player },
            `connection with ${player.id} closed, cleaning offers`
          )
          setPlaying(player.id, false)
          socketByPlayerId.delete(player.id)
        }
      })
    }
  )
}

export default fp(peerSignal, {
  fastify: '>= 3.15.0',
  name: 'tabulous-peer-signal',
  dependencies: ['fastify-websocket']
})
