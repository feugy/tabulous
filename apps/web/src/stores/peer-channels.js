import 'webrtc-adapter'

import { auditTime, BehaviorSubject, filter, scan, Subject } from 'rxjs'

import * as graphQL from '../graphql'
import { makeLogger, PeerConnection } from '../utils'
import { runMutation, runSubscription } from './graphql-client'
import {
  acquireMediaStream,
  localStreamChange$,
  releaseMediaStream,
  stream$
} from './stream'

const logger = makeLogger('peer-channels')

const bitrate = 128
const connections = new Map()
const streamSubscriptionByPlayerId = new Map()
const lastMessageSent$ = new Subject()
const lastMessageReceived$ = new Subject()
const unorderedMessages$ = new Subject()
const connected$ = new BehaviorSubject([])
const lastConnectedId$ = new Subject()
const lastDisconnectedId$ = new Subject()
let subscriptions = []
let current
let messageId = 1
let local = {}
resetLocalState()

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
 * @param {string} gameId - joined game Id.
 */
export async function openChannels(player, turnCredentials, gameId) {
  current = { player }
  logger.info({ player }, 'initializing peer communication')

  resetLocalState()
  subscriptions = [
    localStreamChange$.pipe(auditTime(10)).subscribe(state => {
      Object.assign(local, state)
      for (const peer of connections.values()) {
        peer.setLocalState(state)
      }
    }),
    stream$.subscribe(stream => {
      local.stream = stream
      for (const peer of connections.values()) {
        peer.attachLocalStream(local.stream)
      }
    })
  ]

  return new Promise(resolve => {
    subscriptions.push(
      runSubscription(graphQL.awaitSignal, { gameId }).subscribe(
        async ({ from, data }) => {
          const signal = JSON.parse(data)
          logger.debug({ from, signal }, `receiving ${signal.type} from server`)
          if (signal.type === 'ready') {
            resolve()
          } else if (signal.type === 'offer' && !connections.has(from)) {
            // new peer joining
            const peer = new PeerConnection({
              local,
              bitrate,
              turnCredentials,
              sendSignal(playerId, signal) {
                runMutation(graphQL.sendSignal, {
                  signal: { to: playerId, data: JSON.stringify(signal) }
                })
              },
              onData: buildDataHandler(from),
              onRemoteStream: buildStreamHandler(from),
              onRemoteState: () => refreshConnected(),
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
              if (!peer.hasLocalStream()) {
                await acquireMediaStream()
              }
            } catch (error) {
              logger.warn(
                { peer, error },
                `failed to connect with peer ${from}: ${error.message}`
              )
            }
          } else {
            connections.get(from)?.handleSignal(signal)
          }
        }
      )
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
  if (!subscriptions.length || !current) return
  logger.info(
    { to: playerId, from: current.player.id },
    `establishing connection with peer ${playerId}`
  )
  if (!local.stream) {
    local.stream = await acquireMediaStream()
  }
  const peer = new PeerConnection({
    local,
    bitrate,
    turnCredentials,
    sendSignal(playerId, signal) {
      runMutation(graphQL.sendSignal, {
        signal: { to: playerId, data: JSON.stringify(signal) }
      })
    },
    onData: buildDataHandler(playerId),
    onRemoteStream: buildStreamHandler(playerId),
    onRemoteState: () => refreshConnected(),
    onClose: () => {
      logger.warn({ peer }, `connection terminated with peer ${playerId}`)
      unwire(playerId)
    }
  })
  connections.set(playerId, peer)
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
  for (const subscription of subscriptions) {
    subscription?.unsubscribe()
  }
  subscriptions = []
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
  lastMessageSent$.next({ data, playerId: current.player.id })
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
          ({ playerId, remote }) => ({ playerId, ...remote })
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
      lastMessageReceived$.next({ data, playerId })
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
    connections.get(playerId).setRemote({ stream })
    refreshConnected()
  }
}

function resetLocalState() {
  local = {
    stream: null,
    muted: false,
    stopped: false
  }
}
