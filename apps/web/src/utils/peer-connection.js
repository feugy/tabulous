import { makeLogger } from './logger'
import { buildSDPTransform } from './webrtc'

const logger = makeLogger('peer-connection')

export class PeerConnection {
  constructor({ turnCredentials, bitrate, sendSignal, onData, onClose }) {
    this.lastMessageId = 0
    this.established = false
    this.stream = undefined
    this.streamState = undefined
    this.dataChannel = undefined
    this.sendSignal = sendSignal
    this.onData = onData
    this.onClose = onClose
    this.transformSdp = buildSDPTransform({ bitrate })
    this.connection = new RTCPeerConnection({
      iceServers: getIceServers(turnCredentials)
    })
  }

  async connect(playerId, offer) {
    this.playerId = playerId
    logger.info(
      serialize(this),
      `connecting with ${playerId}${offer ? '' : ' as initiator'}`
    )

    const handleIceCandidate = ({ candidate }) => {
      if (candidate) {
        this.sendSignal(playerId, 'candidate', candidate)
      }
    }

    let handleDataOpen
    let handleStateChange

    const buildHanldeDataOpen = resolve => {
      handleDataOpen = () => {
        logger.info(serialize(this), `connection established with ${playerId}`)
        this.dataChannel.removeEventListener('open', handleDataOpen)
        this.connection.removeEventListener('icecandidate', handleIceCandidate)
        this.dataChannel.addEventListener('message', event => {
          const data = JSON.parse(event.data)
          logger.trace(serialize(this, { data }), `data from ${playerId}`)
          this.onData(data)
        })
        this.established = true
        resolve()
      }
    }

    const buildHanldeStateChange = reject => {
      handleStateChange = () => {
        const { connectionState: state } = this.connection
        logger.debug(serialize(this, { state }), `connection is now ${state}`)
        if (state === 'closed') {
          this.dataChannel.removeEventListener('open', handleDataOpen)
          this.connection.removeEventListener(
            'connectionstatechange',
            handleStateChange
          )
          this.connection.removeEventListener(
            'icecandidate',
            handleIceCandidate
          )
          const wasEstablised = this.established
          this.established = false
          this.onClose()
          if (!wasEstablised) {
            reject(new Error(`failed to establish connection with ${playerId}`))
          }
        }
      }
    }
    this.connection.addEventListener('icecandidate', handleIceCandidate)

    if (!offer) {
      // is the initiator
      this.dataChannel = this.connection.createDataChannel('data')
      try {
        const offer = await this.connection.createOffer()
        offer.sdp = this.transformSdp(offer.sdp)
        this.connection.setLocalDescription(offer)
        logger.info(serialize(this, { offer }), `sending offer to ${playerId}`)
        this.sendSignal(playerId, 'offer', offer)
      } catch (error) {
        logger.warn(
          serialize(this, { error }),
          `failed to create offer: ${error.message}`
        )
        this.connection.removeEventListener('icecandidate', handleIceCandidate)
        throw error
      }
      await new Promise((resolve, reject) => {
        buildHanldeDataOpen(resolve)
        buildHanldeStateChange(reject)
        this.dataChannel.addEventListener('open', handleDataOpen)
        this.connection.addEventListener(
          'connectionstatechange',
          handleStateChange
        )
      })
    } else {
      // already have an offer
      try {
        this.connection.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await this.connection.createAnswer()
        answer.sdp = this.transformSdp(answer.sdp)
        this.connection.setLocalDescription(answer)
        logger.info(
          serialize(this, { answer }),
          `sending answer to ${playerId}`
        )
        this.sendSignal(playerId, 'answer', answer)
      } catch (error) {
        logger.warn(
          serialize(this, { error }),
          `failed to create answer: ${error.message}`
        )
        this.connection.removeEventListener('icecandidate', handleIceCandidate)
        throw error
      }
      await new Promise((resolve, reject) => {
        const handleDataChannel = ({ channel }) => {
          this.dataChannel = channel
          this.connection.removeEventListener('datachannel', handleDataChannel)

          buildHanldeDataOpen(resolve)
          buildHanldeStateChange(reject)
          this.dataChannel.addEventListener('open', handleDataOpen)
          this.connection.addEventListener(
            'connectionstatechange',
            handleStateChange
          )
        }
        this.connection.addEventListener('datachannel', handleDataChannel)
      })
    }
  }

  async handleSignal(type, signal) {
    logger.debug(
      serialize(this, { type, signal }),
      `receiving ${type} from server`
    )
    if (type === 'answer') {
      try {
        await this.connection.setRemoteDescription(
          new RTCSessionDescription(signal)
        )
      } catch (error) {
        logger.warn(
          serialize(this, { type, signal, error }),
          `failed setting remote description`,
          error
        )
        this.connection.close()
      }
    } else if (type === 'candidate') {
      try {
        await this.connection.addIceCandidate(new RTCIceCandidate(signal))
      } catch (error) {
        logger.warn(
          serialize(this, { type, signal, error }),
          `failed adding ICE candidate`,
          error
        )
      }
    }
  }

  sendData(data) {
    logger.trace(serialize(this, { data }), `sending data to ${this.playerId}`)
    this.dataChannel?.send(JSON.stringify(data))
  }

  destroy() {
    logger.info(serialize(this), `close connection to ${this.playerId}`)
    this.connection?.close()
  }
}

function getIceServers(/*{ username, credentials: credential }*/) {
  return [
    // { urls: 'stun:tabulous.fr' },
    // { urls: 'turn:tabulous.fr', username, credential },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
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
    established,
    stream,
    streamState,
    ...extra
  }
}
