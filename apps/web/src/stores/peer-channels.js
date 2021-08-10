import 'webrtc-adapter'
import Peer from 'simple-peer-light'
import WebSocket from 'reconnecting-websocket'
import { BehaviorSubject, Subject } from 'rxjs'
import { filter, scan } from 'rxjs/operators'
import { makeLogger } from '../utils'

const logger = makeLogger('peer-channels')

let socket
let current
let messageId = 1
const channels = new Map()
const lastMessageSent$ = new Subject()
const lastMessageReceived$ = new Subject()
const unorderedMessages$ = new Subject()
const connected$ = new BehaviorSubject([])
const lastConnectedId$ = new Subject()
const lastDisconnectedId$ = new Subject()

/**
 * @typedef {object} PeerPlayer
 * @property {object} player - player object
 * @property {stream} stream? - video stream from that player
 */

function refreshConnected() {
  connected$.next(
    channels.size > 0
      ? [current, ...channels.values()].map(({ player, stream }) => ({
          player,
          stream
        }))
      : []
  )
}

function unwire(id) {
  logger.debug({ id }, `cleaning connection to ${id}`)
  channels.get(id)?.peer?.destroy()
  channels.delete(id)
  refreshConnected()
  lastDisconnectedId$.next(id)
}

function sendThroughSocket(message) {
  socket.send(JSON.stringify(message))
}

unorderedMessages$
  .pipe(
    // orders message, lower id first
    scan(
      (list, last) =>
        last === null
          ? null
          : [...list, last].sort((a, b) => a.data.messageId - b.data.messageId),
      []
    ),
    filter(list => {
      // no list or list of one? do not emit
      if (list === null || list.length === 1) {
        return false
      }
      // emit only if all messages are in order
      return list.every(
        ({ data: { messageId } }, i) =>
          i === 0 || list[i - 1].data.messageId === messageId - 1
      )
    })
  )
  .subscribe(list => {
    // processes each ordered message, and clears list
    for (const data of list) {
      lastMessageReceived$.next(data)
    }
    unorderedMessages$.next(null)
  })

async function createPeer({ signal, from, to }) {
  return new Promise(resolve => {
    const peer = new Peer({
      initiator: signal === undefined,
      stream: current.stream,
      trickle: false, // true does not work at all on localhost (FF prints turn/stun warnings after answer)
      config: {
        iceServers: [
          { urls: 'stun:turn2.l.google.com' }
          // { urls: 'stun:localhost:3478' },
          // { urls: 'turn:localhost:3478', username: 'tabulous', credential: 'soulubat' }
        ]
      }
    })
    logger.debug({ peer }, `peer created`)
    channels.set(to.id, { peer, lastMessageId: 0, player: to })

    if (signal) {
      peer.signal(signal)
    }

    peer.on('stream', stream => {
      logger.debug({ peer }, `receiving stream from ${to.id}`)
      channels.get(to.id).stream = stream
      refreshConnected()
    })

    peer.on('signal', signal => {
      const type = signal?.type
      if (type === 'offer' || type === 'answer') {
        logger.debug(
          { peer, signal },
          `${signal.type} ready, sharing with server`
        )
        sendThroughSocket({ type, to, from, signal })
      }
    })

    // TODO connect event may not follow peer.signal(). use a timeout
    peer.on('connect', () => {
      logger.info({ peers: channels }, `connection established with ${to.id}`)

      peer.on('error', error =>
        logger.warn(
          { peer, error },
          `peer ${to.id} encounter an error: ${error.message}`
        )
      )

      peer.on('data', stringData => {
        const data = JSON.parse(stringData)
        logger.trace({ data, peer }, `data from ${to.id}`)

        const { lastMessageId } = channels.get(to.id)
        if (data.messageId !== lastMessageId + 1 && lastMessageId > 0) {
          logger.error(
            `Invalid message ids: received ${data.messageId}, expecting: ${lastMessageId}`
          )
          unorderedMessages$.next({ data, from: to })
        } else {
          lastMessageReceived$.next({ data, from: to })
        }
        // stores higher last only, so unorderedMessage could get lower ones
        if (data.messageId > lastMessageId) {
          channels.get(to.id).lastMessageId = data.messageId
        }
      })

      peer.on('close', () => {
        logger.info({ peer }, `connection to ${to.id} closed`)
        unwire(to.id)
      })

      refreshConnected()
      lastConnectedId$.next(to.id)
      resolve(peer)
    })
  })
}

async function attachLocalMedia() {
  if (!current || current.stream) return
  logger.info(`attaching local media to current peer`)
  if (navigator.mediaDevices) {
    try {
      current.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      })
    } catch (error) {
      logger.warn({ error }, `Failed to access media devices: ${error.message}`)
    }
  }
}

/**
 * Emits last data sent to another player
 * @type {Observable<object>}
 */
export const lastMessageSent = lastMessageSent$.asObservable()

/**
 * Emits last data received from other connected players
 * @type {Observable<object>}
 */
export const lastMessageReceived = lastMessageReceived$.asObservable()

/**
 * Emits an array of currently connected player descriptors
 * @type {Observable<[PeerPlayer]>}
 */
export const connected = connected$.asObservable()

/**
 * Emits player id of the last connected player
 * @type {Observable<string>}
 */
export const lastConnectedId = lastConnectedId$.asObservable()

/**
 * Emits player id of the last disconnected player
 * @type {Observable<string>}
 */
export const lastDisconnectedId = lastDisconnectedId$.asObservable()

/**
 * Configures communication channels in order to honor other players' connection requests
 * @async
 * @param {object} player - current player
 * @param {object?} stream - media stream object returned by getUserMedia()
 */
export async function openChannels(player) {
  current = { player }
  logger.info({ player }, 'initializing peer communication')

  const ws = new WebSocket(
    `${location.origin.replace('http', 'ws')}/ws?bearer=${player.id}`
  )
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', function () {
      logger.debug({ player }, 'WebSocket connected')
      socket = ws
      socket.addEventListener('message', async ({ data: rawData }) => {
        try {
          const data = JSON.parse(rawData)
          const type = data?.signal?.type
          if (type === 'offer') {
            logger.debug(data, `receiving offer from server, create peer`)
            const { from, to, signal } = data
            const channel = channels.get(from?.id)
            if (channel) {
              // existing peer negociation
              channel.peer.signal(signal)
            } else {
              // new peer joining
              await attachLocalMedia()
              createPeer({ ...data, from: to, to: from })
            }
          } else if (type === 'answer') {
            logger.debug(
              data,
              `receiving answer from server, completing connection`
            )
            const { from, signal } = data
            const channel = channels.get(from?.id)
            if (channel) {
              channel.peer.signal(signal)
            } else {
              logger.warn(
                { data, channels },
                `no peer found for answer from ${from?.id}`
              )
            }
          }
        } catch (error) {
          logger.warn(
            { error, rawData },
            `failed to process data from signaling server`
          )
        }
      })
      resolve()
    })

    ws.addEventListener('error', reject)
  })
}

/**
 * Connects with another player, asking to attach media if necessary.
 * @async
 * @param {object} player - player to connect with
 * @returns {Peer} - connection, in case of success
 * @throws {Error} when no connected peer is matching provided id
 */
export async function connectWith(player) {
  if (!socket || !current) return
  logger.info(
    { to: player, from: current.player },
    `establishing connection with peer ${player.id}`
  )
  await attachLocalMedia()
  return await createPeer({ to: player, from: current.player })
}

/**
 * Closes all communication channels.
 * Also stops local media if relevant.
 */
export function closeChannels() {
  logger.info(`closing peer communication`)
  // copies all keys as we're about to alter the collection
  for (const id of [...channels.keys()]) {
    unwire(id)
  }
  socket?.close()
  socket = null
  if (current?.stream) {
    for (const track of current.stream.getTracks()) {
      track.stop()
    }
  }
  current = null
}

/**
 * Sends data to a single peer, or to all peers.
 * Cleans connecte
 * @param {object} data - sent data, no specific structure required
 * @param {string} [playerId] - targeted player id. Do not provide to broacast data
 */
export function send(data, playerId = null) {
  lastMessageSent$.next({ data, from: current?.player })
  if (playerId && !channels.has(playerId)) {
    return
  }
  const destination = playerId
    ? new Map([[playerId, channels.get(playerId)]])
    : channels
  for (const [playerId, { peer }] of destination) {
    logger.trace({ data, peer }, `sending data to ${playerId}`)
    try {
      peer.send(JSON.stringify({ ...data, messageId }))
    } catch (error) {
      logger.warn(
        { error, peer, data },
        `failed to send data to peer ${playerId}: ${error.message}`
      )
    }
  }
  messageId++
}
