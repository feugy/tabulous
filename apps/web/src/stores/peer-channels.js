// @ts-check
/**
 * @typedef {import('rxjs').Subscription} Subscription
 * @typedef {import('@tabulous/server/src/graphql').Player} Player
 * @typedef {import('@tabulous/server/src/graphql').TurnCredentials} TurnCredentials
 * @typedef {import('@src/utils').StreamState} StreamState
 * @typedef {import('@src/utils').Stream} Stream
 */

// mandatory side effect
import 'webrtc-adapter'

import * as graphQL from '@src/graphql'
import { auditTime, BehaviorSubject, Subject } from 'rxjs'

import { makeLogger, PeerConnection } from '../utils'
import { runMutation, runSubscription } from './graphql-client'
import {
  acquireMediaStream,
  localStreamChange$,
  releaseMediaStream,
  stream$
} from './stream'

/** @typedef {{ playerId: string } & Partial<StreamState>} Connected */

const logger = makeLogger('peer-channels')

/**
 * @typedef {object} Message message received or sent viw WebRTC.
 * @property {string} playerId - if of the sending/receiving player.
 * @property {?} data - data sent or received.
 */

const bitrate = 128
/** @type {Map<string, PeerConnection>} */
const connections = new Map()
/** @type {Subject<Message>} */
const lastMessageSent$ = new Subject()
/** @type {Subject<Message>} */
const lastMessageReceived$ = new Subject()
const connected$ = new BehaviorSubject(/** @type {Connected[]} */ ([]))
/** @type {Subject<string>} */
const lastConnectedId$ = new Subject()
/** @type {Subject<string>} */
const lastDisconnectedId$ = new Subject()
/** @type {Subscription[]} */
let subscriptions = []
/** @type {?{ player: Player }} */
let current = null
/** @type {Stream} */
let local = {
  stream: null,
  muted: false,
  stopped: false
}

/**
 * Emits last data sent to another player
 */
export const lastMessageSent = lastMessageSent$.asObservable()

/**
 * Emits last data received from other connected players
 */
export const lastMessageReceived = lastMessageReceived$.asObservable()

/**
 * Emits an array of currently connected player descriptors.
 * If current player is single, the array will be empty, otherwise it always comes first.
 */
export const connected = connected$.asObservable()

/**
 * Emits player id of the last connected player
 */
export const lastConnectedId = lastConnectedId$.asObservable()

/**
 * Emits player id of the last disconnected player
 */
export const lastDisconnectedId = lastDisconnectedId$.asObservable()

/**
 * Configures communication channels in order to honor other players' connection requests
 * @param {Player} player - current player
 * @param {TurnCredentials} turnCredentials - turn credentials from session.
 * @param {string} gameId - joined game Id.
 * @returns {Promise<void>}
 */
export async function openChannels(player, turnCredentials, gameId) {
  current = { player }
  logger.info({ player }, 'initializing peer communication')

  subscriptions = [
    localStreamChange$.pipe(auditTime(10)).subscribe(state => {
      Object.assign(local, state)
      for (const peer of connections.values()) {
        peer.setLocalState(state)
      }
    }),
    stream$.subscribe(stream => {
      if (stream) {
        local.stream = stream
        for (const peer of connections.values()) {
          peer.attachLocalStream(local.stream)
        }
      }
    })
  ]

  return new Promise(resolve => {
    subscriptions.push(
      runSubscription(graphQL.awaitSignal, { gameId }).subscribe(
        async ({ from, data }) => {
          const signal = JSON.parse(data)
          logger.debug(
            { from, signal },
            `receiving ${signal.type ?? 'candidate'} from server`
          )
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
                `failed to connect with peer ${from}: ${
                  /** @type {Error} */ (error).message
                }`
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
 * @param {TurnCredentials} turnCredentials - turn credentials from session.
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
      `failed to connect with peer ${playerId}: ${
        /** @type {Error} */ (error).message
      }`
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
 * @param {?string} [playerId] - targeted player id. Do not provide to broacast data
 */
export function send(data, playerId = null) {
  if (!current?.player || (playerId && !connections.has(playerId))) {
    return
  }
  lastMessageSent$.next({ data, playerId: current.player.id })
  const destination = playerId
    ? new Map([
        [playerId, /** @type {PeerConnection} */ (connections.get(playerId))]
      ])
    : connections
  for (const [playerId, peer] of destination) {
    if (peer.established) {
      try {
        peer.sendData(data)
      } catch (error) {
        logger.warn(
          { error, peer, data },
          `failed to send data to peer ${playerId}: ${
            /** @type {Error} */ (error).message
          }`
        )
        unwire(playerId)
      }
    }
  }
}

function refreshConnected() {
  const peers = [...connections.values()].filter(
    ({ established }) => established
  )
  connected$.next(
    peers.length > 0
      ? [
          { playerId: /** @type {{ player: Player }} */ (current).player.id },
          ...peers.map(({ playerId, remote }) => ({
            playerId: /** @type {string} */ (playerId),
            ...remote
          }))
        ]
      : []
  )
}

function unwire(/** @type {string} */ id) {
  logger.debug({ id }, `cleaning connection to ${id}`)
  connections.get(id)?.destroy()
  connections.delete(id)
  refreshConnected()
  if (connections.size === 0) {
    releaseMediaStream()
    local.stream = null
  }
  lastDisconnectedId$.next(id)
}

function buildDataHandler(/** @type {string} */ playerId) {
  return function handleData(/** @type {?} */ data) {
    lastMessageReceived$.next({ data, playerId })
  }
}

function buildStreamHandler(/** @type {string} */ playerId) {
  return function handleRemoteStream(/** @type {MediaStream} */ stream) {
    logger.debug({ from: playerId }, `receiving stream from ${playerId}`)
    connections.get(playerId)?.setRemote({ stream })
    refreshConnected()
  }
}
