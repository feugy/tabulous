import 'webrtc-adapter'
import Peer from 'simple-peer-light'
import { BehaviorSubject, Subject } from 'rxjs'
import { filter, scan } from 'rxjs/operators'
import { get } from 'svelte/store'
import { runMutation, runSubscription } from './graphql-client'
import { turnCredentials } from './players'
import { acquireMediaStream, releaseMediaStream, stream$ } from './stream'
import * as graphQL from '../graphql'
import { makeLogger } from '../utils'

const logger = makeLogger('peer-channels')

let signalSubscription
let current
let messageId = 1
const connectDuration = 20000
const channels = new Map()
const streamSubscriptionByPlayerId = new Map()
const lastMessageSent$ = new Subject()
const lastMessageReceived$ = new Subject()
const unorderedMessages$ = new Subject()
const connected$ = new BehaviorSubject([])
const lastConnectedId$ = new Subject()
const lastDisconnectedId$ = new Subject()

/**
 * @typedef {object} PeerPlayer
 * @property {string} playerId - player id
 * @property {stream} stream? - media stream from that player
 */

function refreshConnected() {
  const peers = [...channels.values()].filter(({ established }) => established)
  connected$.next(
    peers.length > 0
      ? [{ playerId: current.player.id }, ...peers].map(
          ({ playerId, stream }) => ({ playerId, stream })
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

async function createPeer(playerId, signal) {
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
          peer.addStream(stream)
          peer.removeStream(peer.streams[0])
          return
        }
        peer = new Peer({
          initiator: signal === undefined,
          stream,
          trickle: true,
          config: {
            iceServers: getIceServers()
          }
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

        peer.on('error', error =>
          logger.warn(
            { peer, error },
            `peer ${playerId} encounter an error: ${error.message}`
          )
        )

        peer.on('close', () => {
          clearTimeout(connectTimeout)
          logger.info({ peer }, `connection to ${playerId} closed`)
          unwire(playerId)
        })

        peer.on('stream', stream => {
          logger.debug({ peer }, `receiving stream from ${playerId}`)
          channels.get(playerId).stream = stream
          refreshConnected()
        })

        peer.on('signal', signal => {
          const type = signal?.type
          logger.debug(
            { peer, signal },
            `${signal.type} ready, sharing with server`
          )
          runMutation(graphQL.sendSignal, {
            signal: { type, to: playerId, signal: JSON.stringify(signal) }
          })
        })

        peer.on('data', stringData => {
          const data = JSON.parse(stringData)
          logger.debug({ data, peer }, `data from ${playerId}`)

          const { lastMessageId } = channels.get(playerId)
          if (data.messageId !== lastMessageId + 1 && lastMessageId > 0) {
            logger.error(
              `Invalid message ids: received ${data.messageId}, expecting: ${lastMessageId}`
            )
            unorderedMessages$.next({ data, playerId })
          } else {
            lastMessageReceived$.next({ data, playerId })
          }
          // stores higher last only, so unorderedMessage could get lower ones
          if (data.messageId > lastMessageId) {
            channels.get(playerId).lastMessageId = data.messageId
          }
        })

        peer.on('connect', () => {
          clearTimeout(connectTimeout)
          logger.info(
            { peers: channels },
            `connection established with ${playerId}`
          )
          channels.get(playerId).established = true
          refreshConnected()
          lastConnectedId$.next(playerId)
          resolve(peer)
        })

        if (signal) {
          peer.signal(signal)
        }
      })
    )
    acquireMediaStream()
  })
}

function getIceServers() {
  const { username, credentials: credential } = get(turnCredentials)
  return [
    { urls: ['stun:tabulous.fr'] },
    { urls: ['turn:tabulous.fr'], username, credential }
  ]
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
 * @param {string} gameId - id of the game this player is playing.
 */
export async function openChannels(player, gameId) {
  current = { player }
  logger.info({ player }, 'initializing peer communication')

  signalSubscription = runSubscription(graphQL.awaitSignal, {
    gameId
  }).subscribe(async ({ from, signal, type }) => {
    const channel = channels.get(from)
    if (type === 'offer') {
      logger.info({ from, signal }, `receiving offer from server, create peer`)
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
        createPeer(from, signal)
      }
    }
  })
}

/**
 * Connects with another player, asking to attach media if necessary.
 * @async
 * @param {string} playerId - id of the player to connect with
 * @returns {Peer} - connection, in case of success
 * @throws {Error} when no connected peer is matching provided id
 */
export async function connectWith(playerId) {
  if (!signalSubscription || !current) return
  logger.info(
    { to: playerId, from: current.player.id },
    `establishing connection with peer ${playerId}`
  )
  return await createPeer(playerId)
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
  lastMessageSent$.next({ data, playerId: current.player.id })
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
