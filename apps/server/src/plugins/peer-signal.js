import fp from 'fastify-plugin'
import { setPlaying } from '../services/index.js'
import { getAuthenticatedPlayer } from './utils.js'

/**
 * Registers routes to implement a WebRTC signaling server, based on WebSockets.
 * TODO more doc
 * @param {fastify} app - a fastify application
 * @param {object} opts - plugin's options, including:
 * @param {string} [opts.path='/ws'] - the websocket endpoint path
 */
async function peerSignal(app, opts = {}) {
  const path = opts.path || '/ws'
  const socketByPlayerId = new Map()

  app.get(
    path,
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
  name: 'fastify-peer-signal',
  dependencies: ['fastify-websocket']
})
