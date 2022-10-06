import 'webrtc-adapter'
import { auditTime, BehaviorSubject, Subject, filter, scan } from 'rxjs'
import { runMutation, runSubscription } from './graphql-client'
import {
  acquireMediaStream,
  releaseMediaStream,
  localStreamChange$
} from './stream'
import * as graphQL from '../graphql'
import { makeLogger, PeerConnection } from '../utils'

const logger = makeLogger('peer-channels')

const bitrate = 128
const controlType = 'control'
const connections = new Map()
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

  return new Promise(resolve => {
    signalSubscription = runSubscription(graphQL.awaitSignal).subscribe(
      async ({ from, signal: signalRaw, type }) => {
        logger.debug({ from, signalRaw, type }, `receiving ${type} from server`)
        const signal = JSON.parse(signalRaw)
        if (type === 'ready') {
          resolve()
        } else if (type === 'offer' && !connections.has(from)) {
          // new peer joining
          const peer = new PeerConnection({
            bitrate,
            turnCredentials,
            sendSignal(playerId, type, signal) {
              runMutation(graphQL.sendSignal, {
                signal: { type, to: playerId, signal: JSON.stringify(signal) }
              })
            },
            onData: buildDataHandler(from),
            onRemoteStream: buildStreamHandler(from),
            onClose: () => {
              logger.warn({ peer }, `connection terminated with peer ${from}`)
              unwire(from)
            }
          })
          connections.set(from, peer)
          try {
            await peer.connect(from, signal)
            refreshConnected()
            lastConnectedId$.next(from)
            peer.attach(await acquireMediaStream())
          } catch (error) {
            logger.warn(
              { peer, error },
              `failed to connect with peer ${from}: ${error.message}`
            )
          }
        } else {
          connections.get(from)?.handleSignal(type, signal)
        }
      }
    )
  })
}

/**
 * Connects with another player, asking to attach media if necessary.
 * @async
 * @param {string} playerId - id of the player to connect with.
 * @param {object} turnCredentials - turn credentials from session.
 * @throws {Error} when no connected peer is matching provided id.
 */
export async function connectWith(playerId, turnCredentials) {
  if (!signalSubscription || !current) return
  logger.info(
    { to: playerId, from: current.player.id },
    `establishing connection with peer ${playerId}`
  )
  const peer = new PeerConnection({
    bitrate,
    turnCredentials,
    sendSignal(playerId, type, signal) {
      runMutation(graphQL.sendSignal, {
        signal: { type, to: playerId, signal: JSON.stringify(signal) }
      })
    },
    onData: buildDataHandler(playerId),
    onRemoteStream: buildStreamHandler(playerId),
    onClose: () => {
      logger.warn({ peer }, `connection terminated with peer ${playerId}`)
      unwire(playerId)
    }
  })
  connections.set(playerId, peer)
  peer.attach(await acquireMediaStream())
  try {
    await peer.connect(playerId)
    refreshConnected()
    lastConnectedId$.next(playerId)
    return peer
  } catch (error) {
    logger.warn(
      { peer, error },
      `failed to connect with peer ${playerId}: ${error.message}`
    )
    throw error
  }
}

/**
 * Closes all communication channels.
 * Also stops local media if relevant.
 */
export function closeChannels() {
  logger.info(`closing peer communication`)
  // copies all keys as we're about to alter the collection
  for (const id of [...connections.keys()]) {
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
  if (!current?.player || (playerId && !connections.has(playerId))) {
    return
  }
  if (data?.type !== controlType) {
    lastMessageSent$.next({ data, playerId: current.player.id })
  }
  const destination = playerId
    ? new Map([[playerId, connections.get(playerId)]])
    : connections
  for (const [playerId, peer] of destination) {
    if (peer.established) {
      try {
        peer.sendData({ ...data, messageId })
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
  const peers = [...connections.values()].filter(
    ({ established }) => established
  )
  connected$.next(
    peers.length > 0
      ? [{ playerId: current.player.id }, ...peers].map(
          ({ playerId, stream, streamState }) => ({
            playerId,
            stream,
            streamState
          })
        )
      : []
  )
}

function unwire(id) {
  logger.debug({ id }, `cleaning connection to ${id}`)
  connections.get(id)?.destroy()
  connections.delete(id)
  streamSubscriptionByPlayerId.get(id)?.unsubscribe()
  streamSubscriptionByPlayerId.delete(id)
  refreshConnected()
  if (connections.size === 0) {
    releaseMediaStream()
  }
  lastDisconnectedId$.next(id)
}

function buildDataHandler(playerId) {
  return function handleData(data) {
    const { lastMessageId } = connections.get(playerId)
    if (data.messageId !== lastMessageId + 1 && lastMessageId > 0) {
      logger.error(
        `Invalid message ids: received ${data.messageId}, expecting: ${lastMessageId}`
      )
      unorderedMessages$.next({ data, playerId })
    } else {
      if (data?.type === controlType) {
        connections.get(playerId).streamState = data.streamState ?? {}
        refreshConnected()
      } else {
        lastMessageReceived$.next({ data, playerId })
      }
    }
    // stores higher last only, so unorderedMessage could get lower ones
    if (data.messageId > lastMessageId) {
      connections.get(playerId).lastMessageId = data.messageId
    }
  }
}

function buildStreamHandler(playerId) {
  return function handleRemoteStream(stream) {
    logger.debug({ from: playerId }, `receiving stream from ${playerId}`)
    connections.get(playerId).stream = stream
    refreshConnected()
  }
}
