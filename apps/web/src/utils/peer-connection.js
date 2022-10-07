import { makeLogger } from './logger'
import { buildSDPTransform } from './webrtc'

const logger = makeLogger('peer-connection')

export class PeerConnection {
  constructor({
    turnCredentials,
    bitrate,
    sendSignal,
    onData,
    onRemoteStream,
    onClose
  }) {
    this.lastMessageId = 0
    this.established = false
    this.dataChannel = undefined
    this.sendSignal = sendSignal
    this.onRemoteStream = onRemoteStream
    this.onData = onData
    this.onClose = onClose
    this.stream = undefined
    this.streamState = {}
    this.polite = false
    this.makingOffer = false
    this.ignoreOffer = false
    this.transformSdp = buildSDPTransform({ bitrate })
    this.connection = new RTCPeerConnection({
      iceServers: getIceServers(turnCredentials)
    })
  }

  connect(playerId, description) {
    this.playerId = playerId
    logger.info(serialize(this), `connecting with ${playerId}}`)

    return new Promise((resolve, reject) => {
      this.connection.onnegotiationneeded = async () => {
        try {
          this.makingOffer = true
          await this.connection.setLocalDescription()
          const description = this.connection.localDescription
          // TODO  description.sdp = this.transformSdp(description.sdp)
          logger.info(
            serialize(this, { description }),
            `sending ${description.type} to ${playerId}`
          )
          this.sendSignal(playerId, description.type, description)
        } catch (error) {
          logger.warn(
            serialize(this, { error }),
            `failed to description: ${error.message}`
          )
        } finally {
          this.makingOffer = false
        }
      }

      this.connection.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.sendSignal(playerId, 'candidate', candidate)
        }
      }

      this.connection.oniceconnectionstatechange = () => {
        if (this.connection.iceConnectionState === 'failed') {
          this.connection.restartIce()
        }
      }

      this.connection.onconnectionstatechange = () => {
        const { connectionState: state } = this.connection
        logger.debug(serialize(this, { state }), `connection is now ${state}`)
        if (state === 'closed') {
          const wasEstablised = this.established
          this.established = false
          this.onClose()
          if (!wasEstablised) {
            reject(new Error(`failed to establish connection with ${playerId}`))
          }
        }
      }

      this.connection.ontrack = ({ track, streams }) => {
        track.onunmute = () => {
          this.stream = streams[0]
          this.onRemoteStream(this.stream)
        }
      }

      this.dataChannel = this.connection.createDataChannel('data', {
        negotiated: true,
        id: 0
      })

      this.dataChannel.onmessage = event => {
        if (event.data === 'bye') {
          logger.debug(
            serialize(this),
            `close message received from ${playerId}`
          )
          this.established = false
          this.dataChannel = undefined
          this.onClose()
          return
        }
        const data = JSON.parse(event.data)
        logger.trace(serialize(this, { data }), `data from ${playerId}`)
        this.onData(data)
      }

      this.dataChannel.onopen = () => {
        logger.info(serialize(this), `connection established with ${playerId}`)
        this.dataChannel.onopen = undefined
        this.established = true
        resolve()
      }

      if (description) {
        this.polite = true
        this.handleSignal(description.type, description)
      }
    })
  }

  async handleSignal(type, signal) {
    logger.debug(
      serialize(this, { type, signal }),
      `receiving ${type} from server`
    )
    try {
      if (type === 'candidate') {
        try {
          await this.connection.addIceCandidate(signal)
        } catch (err) {
          if (!this.ignoreOffer) {
            throw err
          }
        }
      } else {
        this.ignoreOffer = !this.polite && hasOfferCollistion(type, this)
        if (this.ignoreOffer) {
          return
        }
        await this.connection.setRemoteDescription(signal)
        if (type === 'offer') {
          await this.connection.setLocalDescription()
          const description = this.connection.localDescription
          // TODO description.sdp = this.transformSdp(description.sdp)
          this.sendSignal(this.playerId, description.type, description)
        }
      }
    } catch (error) {
      logger.warn(
        serialize(this, { type, signal, error }),
        `failed handling remote signal`,
        error
      )
    }
  }

  attach(stream) {
    if (stream) {
      for (const track of stream.getTracks()) {
        this.connection.addTrack(track, stream)
      }
    }
  }

  sendData(data) {
    logger.trace(serialize(this, { data }), `sending data to ${this.playerId}`)
    try {
      this.dataChannel?.send(JSON.stringify(data))
    } catch (error) {
      logger.warn(
        serialize(this, { data, error }),
        `fail to send data to ${this.playerId}: ${error?.message || error}`
      )
    }
  }

  async destroy() {
    logger.info(serialize(this), `close connection to ${this.playerId}`)
    this.dataChannel?.send('bye')
    this.connection?.close()
  }
}

function getIceServers({ username, credentials: credential }) {
  return [
    { urls: 'stun:coturn.tabulous.fr' },
    { urls: 'turn:coturn.tabulous.fr', username, credential }
    // { urls: 'stun:openrelay.metered.ca:80' },
    // {
    //   urls: 'turn:openrelay.metered.ca:80',
    //   username: 'openrelayproject',
    //   credential: 'openrelayproject'
    // }
  ]
}

function hasOfferCollistion(type, { makingOffer, connection }) {
  return (
    type === 'offer' && (makingOffer || connection.signalingState !== 'stable')
  )
}

function serialize(
  {
    connection: {
      connectionState,
      iceConnectionState,
      iceGatheringState,
      signalingState,
      localDescription,
      remoteDescription
    } = {},
    dataChannel: { binaryType, readyState, reliable } = {},
    playerId,
    polite,
    established,
    stream,
    streamState
  },
  extra
) {
  return {
    connection: {
      connectionState,
      iceConnectionState,
      iceGatheringState,
      signalingState,
      localDescription,
      remoteDescription
    },
    dataChannel: { binaryType, readyState, reliable },
    playerId,
    polite,
    established,
    stream,
    streamState,
    ...extra
  }
}
