// @ts-check
import { makeLogger } from './logger'
import { buildSDPTransform } from './webrtc'

const logger = makeLogger('peer-connection')
const controlType = 'stream-control'

/**
 * @typedef {object} StreamState State of a media stream.
 * @property {boolean} muted - whether audio is muted.
 * @property {boolean} stopped - whether video is stopped.
 */

/** @typedef {{ stream: ?MediaStream} & StreamState} Stream Stream and state of local or remote media. */

/**
 * @typedef {object} PeerConnectionOptions
 * @property {object} turnCredentials - credentials for connecting to the TURN server.
 * @property {string} turnCredentials.username - connection username.
 * @property {string} turnCredentials.credentials - connection password.
 * @property {number} bitrate - maximum bitrate applied, in Kbps.
 * @property {Stream} local - local stream.
 * @property {(playerId: string, signal: ?RTCSessionDescription|RTCIceCandidate) => ?} sendSignal - invoked to exchange RTC messages with peer.
 * @property {(data: ?) => ?} onData - invoked when receiving data from the connected peer.
 * @property {(stream: MediaStream) => ?} onRemoteStream - invoked when receiving connected peer's stream.
 * @property {(state: StreamState) => ?} onRemoteState - invoked when receiving connected peer's state change.
 * @property {() => ?} onClose -invoked when connected peer closed the connectino.
 */

/**
 * Utility wrapper to connect to a remote peer with RTC protocol.
 */
export class PeerConnection {
  /**
   * @param {PeerConnectionOptions} options - connection options.
   */
  constructor({
    turnCredentials,
    bitrate,
    local,
    sendSignal,
    onData,
    onRemoteStream,
    onRemoteState,
    onClose
  }) {
    /** @type {?string} */
    this.playerId = null
    /** @type {number} */
    this.lastMessageId = 0
    /** @type {boolean} */
    this.established = false
    /** @type {RTCDataChannel | undefined} */
    this.dataChannel = undefined
    /** @type {PeerConnectionOptions['sendSignal']} */
    this.sendSignal = sendSignal
    /** @type {PeerConnectionOptions['onRemoteStream']} */
    this.onRemoteStream = onRemoteStream
    /** @type {PeerConnectionOptions['onRemoteState']} */
    this.onRemoteState = onRemoteState
    /** @type {PeerConnectionOptions['onData']} */
    this.onData = onData
    /** @type {PeerConnectionOptions['onClose']} */
    this.onClose = onClose
    /** @type {Stream} */
    this.remote = {
      stream: null,
      muted: false,
      stopped: false
    }
    /** @type {Stream} */
    this.local = local || { stream: null, muted: false, stopped: false }
    /** @type {boolean} */
    this.polite = false
    /** @type {boolean} */
    this.makingOffer = false
    /** @type {boolean} */
    this.ignoreOffer = false
    /** @type {ReturnType<buildSDPTransform>} */
    this.transformSdp = buildSDPTransform({ bitrate })
    /** @type {RTCPeerConnection} */
    this.connection = new RTCPeerConnection({
      iceServers: getIceServers(turnCredentials)
    })
  }

  /**
   * @returns {boolean} whether this connection has local stream
   */
  hasLocalStream() {
    return !!this.local.stream
  }

  /**
   * Connects to a remote peer, using perfect negotiaion.
   * You must only provide signal when receiving a connection request from the signaling server.
   * @param {string} playerId - player to connect with
   * @param {RTCSessionDescription} [signal] - when provided, marks this peer as polite.
   * @returns {Promise<void>} resolves when connection is established.
   * @see https://w3c.github.io/webrtc-pc/#perfect-negotiation-example
   */
  connect(playerId, signal) {
    this.playerId = playerId
    logger.info(serialize(this), `connecting with ${playerId}`)

    return new Promise((resolve, reject) => {
      let channelConnected = false
      let dataConnected = false
      const resolveWhenReady = () => {
        if (dataConnected && channelConnected) {
          logger.info(
            serialize(this),
            `connection established with ${playerId}`
          )
          const dataChannel = /** @type {RTCDataChannel} */ (this.dataChannel)
          dataChannel.onopen = null
          this.established = true
          this.setLocalState(this.local)
          resolve()
        }
      }

      this.connection.onnegotiationneeded = async () => {
        try {
          this.makingOffer = true
          await this.connection.setLocalDescription()
          const description = /** @type {RTCSessionDescription} */ (
            this.connection.localDescription
          )
          // TODO  description.sdp = this.transformSdp(description.sdp)
          logger.info(
            serialize(this, { description }),
            `sending ${description.type} to ${playerId}`
          )
          this.sendSignal(playerId, description)
        } catch (error) {
          logger.warn(
            serialize(this, { error }),
            `failed to send description: ${
              /** @type {Error} */ (error).message
            }`
          )
        } finally {
          this.makingOffer = false
        }
      }

      this.connection.onicecandidate = ({ candidate }) => {
        if (candidate) {
          this.sendSignal(playerId, candidate)
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
        if (state === 'connected') {
          channelConnected = true
          resolveWhenReady()
        } else if (state === 'closed') {
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
          this.remote.stream = streams[0]
          this.onRemoteStream(this.remote.stream)
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
        if (data.type === controlType) {
          Object.assign(this.remote, data.state)
          this.onRemoteState(data.state)
        } else {
          this.onData(data)
        }
      }

      this.dataChannel.onopen = () => {
        logger.debug(serialize(this), `data channel opened with ${playerId}`)
        dataConnected = true
        resolveWhenReady()
      }

      if (this.local.stream) {
        this.attachLocalStream(this.local.stream)
      }
      if (signal) {
        this.polite = true
        this.handleSignal(signal)
      }
    })
  }

  /**
   * @param {RTCIceCandidate|RTCSessionDescription} signal - received from the signaling server.
   * @returns {Promise<void>}
   */
  async handleSignal(signal) {
    logger.debug(serialize(this, { signal }), `receiving signal from server`)
    try {
      if (!signal.type) {
        try {
          await this.connection.addIceCandidate(signal)
        } catch (err) {
          if (!this.ignoreOffer) {
            throw err
          }
        }
      } else {
        this.ignoreOffer = !this.polite && hasOfferCollision(signal.type, this)
        if (this.ignoreOffer) {
          return
        }
        await this.connection.setRemoteDescription(
          /** @type {RTCSessionDescription} */ (signal)
        )
        if (signal.type === 'offer') {
          await this.connection.setLocalDescription()
          const description = this.connection.localDescription
          // TODO description.sdp = this.transformSdp(description.sdp)
          this.sendSignal(/** @type {string} */ (this.playerId), description)
        }
      }
    } catch (error) {
      logger.warn(
        serialize(this, { signal, error }),
        `failed handling remote signal`,
        error
      )
    }
  }

  /**
   * Attach local media stream to this connection.
   * @param {MediaStream} [mediaStream] - attached stream.
   */
  attachLocalStream(mediaStream) {
    if (mediaStream) {
      this.local.stream = mediaStream
      for (const track of mediaStream.getTracks()) {
        this.connection.addTrack(track, mediaStream)
      }
    }
  }

  /**
   * Changes state of the local stream, sending relevant command to the connected peer.
   * @param {StreamState} state - new state.
   */
  setLocalState({ muted, stopped }) {
    this.local = { ...this.local, muted, stopped }
    this.sendData({ type: controlType, state: { muted, stopped } })
  }

  /**
   * Attach remote stream to this connection.
   * @param {Partial<Stream>} [remote] - attached stream.
   */
  setRemote(remote = {}) {
    Object.assign(this.remote, remote)
  }

  /**
   * Send data to the connected peer.
   * @param {?} data - sent data.
   */
  sendData(data) {
    logger.trace(serialize(this, { data }), `sending data to ${this.playerId}`)
    try {
      this.dataChannel?.send(JSON.stringify(data))
    } catch (error) {
      logger.warn(
        serialize(this, { data, error }),
        `fail to send data to ${this.playerId}: ${
          error instanceof Error ? error.message : error
        }`
      )
    }
  }

  /**
   * Destroys current connection, gracefully closing it.
   */
  async destroy() {
    logger.info(serialize(this), `close connection to ${this.playerId}`)
    this.dataChannel?.send('bye')
    this.connection?.close()
  }
}

/**
 * @param {PeerConnectionOptions['turnCredentials']} turnCredentials - credentials to connect to the TURN server
 * @returns {RTCIceServer[]} list of TURN and STUN servers.
 */
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

/**
 * @param {RTCSdpType | RTCIceCandidateType} type - received signal from server
 * @param {PeerConnection} connection - current peer connection.
 * @returns {boolean} whether to ignore received offer.
 */
function hasOfferCollision(type, { makingOffer, connection }) {
  return (
    type === 'offer' && (makingOffer || connection.signalingState !== 'stable')
  )
}

/**
 * Utility function to serialize a PeerCnonection instance.
 * @param {PeerConnection} connection - the serialized instance.
 * @param {Record<string, any>} [extra] - extra data to be logged.
 * @returns {Record<string, any>} the serialized object
 */
function serialize(
  {
    connection: {
      connectionState,
      iceConnectionState,
      iceGatheringState,
      signalingState,
      localDescription,
      remoteDescription
    } = /** @type {RTCPeerConnection} */ ({}),
    dataChannel: {
      binaryType,
      readyState
    } = /** @type {RTCDataChannel} */ ({}),
    playerId,
    polite,
    established,
    remote
  },
  extra
) {
  return {
    playerId,
    polite,
    established,
    remote,
    connection: {
      connectionState,
      iceConnectionState,
      iceGatheringState,
      signalingState,
      localDescription,
      remoteDescription
    },
    dataChannel: { binaryType, readyState },
    ...(extra ?? {})
  }
}
