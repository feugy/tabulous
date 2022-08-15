import 'webrtc-adapter'
import Peer from 'simple-peer-light'
import { auditTime, BehaviorSubject, Subject, filter, scan } from 'rxjs'
import { runMutation, runSubscription } from './graphql-client'
import {
  acquireMediaStream,
  releaseMediaStream,
  stream$,
  localStreamChange$
} from './stream'
import * as graphQL from '../graphql'
import { makeLogger, buildSDPTransform } from '../utils'

const logger = makeLogger('peer-channels')

const bitrate = 128
const connectDuration = 20000
const controlType = 'control'
const channels = new Map()
const streamSubscriptionByPlayerId = new Map()
const lastMessageSent$ = new Subject()
const lastMessageReceived$ = new Subject()
const unorderedMessages$ = new Subject()
const connected$ = new BehaviorSubject([])
const lastConnectedId$ = new Subject()
const lastDisconnectedId$ = new Subject()
let signalSubscription
let streamChangeSubscription
let current
let messageId = 1

/**
 * @typedef {object} PeerPlayer
 * @property {string} playerId - player id
 * @property {stream} stream? - media stream from that player
 */

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
 * Emits an array of currently connected player descriptors.
 * If current player is single, the array will be empty, otherwise it always comes first.
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
 * @param {object} player - current player // TODO
 * @param {object} turnCredentials - turn credentials from session.
 */
export async function openChannels(player, turnCredentials) {
  current = { player }
  logger.info({ player }, 'initializing peer communication')

  streamChangeSubscription = localStreamChange$
    .pipe(auditTime(10))
    .subscribe(streamState => send({ type: controlType, streamState }))
  signalSubscription = runSubscription(graphQL.awaitSignal).subscribe(
    async ({ from, signal, type }) => {
      const channel = channels.get(from)
      if (type === 'offer') {
        logger.info(
          { from, signal },
          `receiving offer from server, create peer`
        )
      } else if (type === 'answer') {
        logger.info(
          { from, signal },
          `receiving answer from server, completing connection`
        )
      }
      if (channel) {
        // handshake or negociation
        channel.peer.signal(signal)
      } else {
        if (type === 'offer') {
          // new peer joining
          createPeer(turnCredentials, from, signal)
        }
      }
    }
  )
}

/**
 * Connects with another player, asking to attach media if necessary.
 * @async
 * @param {string} playerId - id of the player to connect with.
 * @param {object} turnCredentials - turn credentials from session.
 * @returns {Peer} - connection, in case of success.
 * @throws {Error} when no connected peer is matching provided id.
 */
export async function connectWith(playerId, turnCredentials) {
  if (!signalSubscription || !current) return
  logger.info(
    { to: playerId, from: current.player.id },
    `establishing connection with peer ${playerId}`
  )
  return await createPeer(turnCredentials, playerId)
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
  releaseMediaStream()
  current = null
  signalSubscription?.unsubscribe()
  signalSubscription = null
  streamChangeSubscription?.unsubscribe()
  streamChangeSubscription = null
}

/**
 * Sends data to a single peer, or to all peers.
 * Cleans connecte
 * @param {object} data - sent data, no specific structure required
 * @param {string} [playerId] - targeted player id. Do not provide to broacast data
 */
export function send(data, playerId = null) {
  if (!current?.player || (playerId && !channels.has(playerId))) {
    return
  }
  if (data?.type !== controlType) {
    lastMessageSent$.next({ data, playerId: current.player.id })
  }
  const destination = playerId
    ? new Map([[playerId, channels.get(playerId)]])
    : channels
  for (const [playerId, { peer, established }] of destination) {
    if (established) {
      logger.debug({ data, peer }, `sending data to ${playerId}`)
      try {
        peer.send(JSON.stringify({ ...data, messageId }))
      } catch (error) {
        logger.warn(
          { error, peer, data },
          `failed to send data to peer ${playerId}: ${error.message}`
        )
        unwire(playerId)
      }
    }
  }
  messageId++
}

function refreshConnected() {
  const peers = [...channels.values()].filter(({ established }) => established)
  connected$.next(
    peers.length > 0
      ? [{ playerId: current.player.id }, ...peers].map(
          ({ playerId, stream, streamState }) => ({
            playerId,
            stream,
            ...(streamState ?? {})
          })
        )
      : []
  )
}

function unwire(id) {
  logger.debug({ id }, `cleaning connection to ${id}`)
  channels.get(id)?.peer?.destroy()
  channels.delete(id)
  streamSubscriptionByPlayerId.get(id)?.unsubscribe()
  streamSubscriptionByPlayerId.delete(id)
  refreshConnected()
  if (channels.size === 0) {
    releaseMediaStream()
  }
  lastDisconnectedId$.next(id)
}

async function createPeer(turnCredentials, playerId, signal) {
  return new Promise((resolve, reject) => {
    let peer
    let isFirst = true
    streamSubscriptionByPlayerId.set(
      playerId,
      stream$.subscribe(stream => {
        if (isFirst) {
          // stream$ is a BehaviorSubject: it'll immediately call the subscriber, while we want to await for actual value
          isFirst = false
          return
        }
        if (peer) {
          peer.removeStream(peer.streams[0])
          if (stream) {
            peer.addStream(stream)
          }
          return
        }
        peer = new Peer({
          initiator: signal === undefined,
          stream,
          trickle: true,
          config: {
            iceServers: getIceServers(turnCredentials)
          },
          sdpTransform: buildSDPTransform({ bitrate })
        })
        peer._debug = function (...args) {
          // simple-peer leverages console string substitution
          return logger.debug(...args, { peer: peer._id })
        }

        logger.debug({ peer }, `peer created`)
        channels.set(playerId, {
          peer,
          lastMessageId: 0,
          playerId,
          established: false
        })

        const connectTimeout = setTimeout(() => {
          const error = new Error(
            `Failed to establish connection after ${Math.floor(
              connectDuration / 1000
            )}`
          )
          logger.error(error.message)
          unwire(playerId)
          reject(error)
        }, connectDuration)

        const context = { playerId, peer, connectTimeout, resolve }
        peer.on('error', buildErrorHandler(context))
        peer.on('close', buildCloseHandler(context))
        peer.on('stream', buildStreamHandler(context))
        peer.on('signal', buildSignalHandler(context))
        peer.on('data', buildDataHandler(context))
        peer.on('connect', buildConnectHandler(context))

        if (signal) {
          peer.signal(signal)
        }
      })
    )
    acquireMediaStream()
  })
}

function buildErrorHandler({ peer, playerId }) {
  return function handleClose(error) {
    logger.warn(
      { peer, error },
      `peer ${playerId} encounter an error: ${error.message}`
    )
  }
}

function buildCloseHandler({ peer, playerId, connectTimeout }) {
  return function handleClose() {
    clearTimeout(connectTimeout)
    logger.info({ peer }, `connection to ${playerId} closed`)
    unwire(playerId)
  }
}

function buildStreamHandler({ peer, playerId }) {
  return function handleStream(stream) {
    logger.debug({ peer }, `receiving stream from ${playerId}`)
    channels.get(playerId).stream = stream
    refreshConnected()
  }
}

function buildSignalHandler({ peer, playerId }) {
  return function handleSignal(signal) {
    const type = signal?.type
    logger.debug({ peer, signal }, `${signal.type} ready, sharing with server`)
    runMutation(graphQL.sendSignal, {
      signal: { type, to: playerId, signal: JSON.stringify(signal) }
    })
  }
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

function buildDataHandler({ peer, playerId }) {
  return function handleData(stringData) {
    const data = JSON.parse(stringData)
    logger.debug({ data, peer }, `data from ${playerId}`)

    const { lastMessageId } = channels.get(playerId)
    if (data.messageId !== lastMessageId + 1 && lastMessageId > 0) {
      logger.error(
        `Invalid message ids: received ${data.messageId}, expecting: ${lastMessageId}`
      )
      unorderedMessages$.next({ data, playerId })
    } else {
      if (data?.type === controlType) {
        channels.get(playerId).streamState = data.streamState
        refreshConnected()
      } else {
        lastMessageReceived$.next({ data, playerId })
      }
    }
    // stores higher last only, so unorderedMessage could get lower ones
    if (data.messageId > lastMessageId) {
      channels.get(playerId).lastMessageId = data.messageId
    }
  }
}

function buildConnectHandler({ connectTimeout, playerId, peer, resolve }) {
  return function handleConnect() {
    clearTimeout(connectTimeout)
    logger.info({ peers: channels }, `connection established with ${playerId}`)
    channels.get(playerId).established = true
    refreshConnected()
    lastConnectedId$.next(playerId)
    resolve(peer)
  }
}

function getIceServers({ username, credentials: credential }) {
  return [
    { urls: 'stun:tabulous.fr' },
    { urls: 'turn:tabulous.fr', username, credential }
  ]
}
