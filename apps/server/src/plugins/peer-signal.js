import fp from 'fastify-plugin'

/**
 * Registers routes to implement a WebRTC signaling server, based on WebSockets.
 * TODO more doc
 * @param {fastify} app - a fastify application
 * @param {object} opts - plugin's options, including:
 * @param {string} [opts.path='/ws'] - the websocket endpoint path
 */
async function peerSignal(app, opts = {}) {
  const path = opts.path || '/ws'
  const offers = new Map()

  app.get(path, { websocket: true }, (connection, { log }) => {
    connection.socket.on('message', rawMessage => {
      try {
        const message = JSON.parse(rawMessage)
        log.debug({ message }, 'receiveing message')

        if (message?.type === 'offer') {
          offers.set(message.player.id, {
            signal: message.signal,
            player: message.player,
            socket: connection.socket
          })
          log.info(message, `storing offer for player ${message.player.id}`)
        } else if (message?.type === 'answer') {
          let found = false
          for (const [to, { socket, from }] of offers) {
            if (from === message.player.id) {
              log.debug(message, `sending anwser to peer ${to}`)
              socket.send(JSON.stringify(message))
              log.info({ to, from }, `handshake complete, cleaning offers`)
              offers.delete(to)
              found = true
              break
            }
          }
          if (!found) {
            log.warn(message, `no offer found for the answer!`)
          }
        } else if (message?.type === 'handshake') {
          const data = offers.get(message.to)
          if (data) {
            log.debug(data, `returning signal connecting to ${message.to}`)
            data.from = message.from
            connection.socket.send(
              JSON.stringify({ signal: data.signal, player: data.player })
            )
          } else {
            log.warn(message, `no offer found for player ${message.to}`)
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
      for (const [playerId, { socket }] of offers) {
        if (socket === connection.socket) {
          log.info(
            { playerId },
            `connection to ${playerId} closed, cleaning offers`
          )
          offers.delete(playerId)
          break
        }
      }
    })
  })
}

export default fp(peerSignal, {
  fastify: '>= 3.15.0',
  name: 'fastify-peer-signal',
  dependencies: ['fastify-websocket']
})
