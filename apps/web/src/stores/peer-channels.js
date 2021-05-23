import Peer from 'simple-peer-light'
import WebSocket from 'reconnecting-websocket'
import { BehaviorSubject, Subject } from 'rxjs'
import { filter, scan } from 'rxjs/operators'
import { makeLogger } from '../utils'

const logger = makeLogger('peer-channels')

const connectTimeout = 3000

let socket
let player
let messageId = 1
const peers = new Map()
const lastMessageSent$ = new Subject()
const lastMessageReceived$ = new Subject()
const unorderedMessages$ = new Subject()
const connected$ = new BehaviorSubject([])
const lastConnected$ = new Subject()

function unwire(peer) {
  const { id } = peer.player
  peer.destroy()
  logger.info({ peer }, `cleaning connection to ${id}`)
  peers.delete(id)
  connected$.next([...peers.keys()])
}

function sendThroughSocket(message) {
  socket.send(JSON.stringify(message))
}

unorderedMessages$
  .pipe(
    // orders message, lower id first
    scan((list, last) =>
      last === null
        ? null
        : [...list, last].sort((a, b) => b.messageId - a.messageId)
    ),
    filter(list => {
      // no list or list of one? do not emit
      if (list === null || list.length === 1) {
        return false
      }
      // emit only if all messages are in order
      return list.every(
        ({ messageId }, i) => i === 0 || list[i - 1].messageId === messageId - 1
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

async function createPeer(playerId) {
  return new Promise((resolve, reject) => {
    const initiator = !playerId
    const peer = new Peer({ initiator, trickle: false })
    logger.debug({ peer, initiator, playerId }, `peer created`)
    let timeout

    peer.on('signal', signal => {
      if (signal?.type === 'offer' || signal?.type === 'answer') {
        logger.debug(
          { peer, signal },
          `${signal.type} ready, sharing with server`
        )
        sendThroughSocket({ type: signal.type, player, signal })
      }
    })

    function handleMessage({ data: rawData }) {
      try {
        const data = JSON.parse(rawData)
        const type = data?.signal?.type
        if (type === (playerId ? 'offer' : 'answer')) {
          clearTimeout(timeout)
          logger.info(data, `receiving ${type} from server, connecting peer`)
          peer.signal(data.signal)
          peer.player = data.player
          socket.removeEventListener('message', handleMessage)
        }
      } catch (error) {
        logger.warn(
          { error, rawData },
          `failed to process data from signaling server`
        )
        peer.destroy()
        socket.removeEventListener('message', handleMessage)
        reject(error)
      }
    }

    socket.addEventListener('message', handleMessage)

    // TODO connect event may not follow peer.signal(). use a timeout
    peer.on('connect', () => {
      peer.on('error', error =>
        logger.warn(
          { peer, error },
          `${peer.player.id} encounter an error: ${error.message}`
        )
      )
      peer.on('data', stringData => {
        const data = JSON.parse(stringData)
        logger.debug({ data, peer }, `data from ${peer.player.id}`)

        const { lastMessageId } = peers.get(peer.player.id)
        if (data.messageId !== lastMessageId + 1 && lastMessageId > 0) {
          console.error(
            `Invalid message ids: received ${data.messageId}, expecting: ${lastMessageId}`
          )
          unorderedMessages$.next({ data, from: peer.player })
        } else {
          lastMessageReceived$.next({ data, from: peer.player })
        }
        // stores higher last only, so unorderedMessage could get lower ones
        if (data.messageId > lastMessageId) {
          peers.get(peer.player.id).lastMessageId = data.messageId
        }
      })
      peer.on('close', () => {
        logger.info({ peer }, `connection to ${peer.player.id} closed`)
        unwire(peer)
      })
      logger.info(
        { peers, peer },
        `connection established with ${peer.player.id}`
      )
      peers.set(peer.player.id, { peer, lastMessageId: 0 })
      connected$.next([...peers.keys()])
      lastConnected$.next(peer.player.id)
      if (initiator) {
        // re-creates initiator to accept further peers
        createPeer()
      }
      resolve(peer)
    })

    if (!initiator) {
      // asks signaling server for an offer
      sendThroughSocket({ type: 'handshake', from: player.id, to: playerId })
      timeout = setTimeout(() => {
        peer.destroy()
        reject(
          new Error(
            `could not peer with player ${playerId}: they are not connected`
          )
        )
      }, connectTimeout)
    }
  })
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
 * Emits an array of currently connected player ids
 * @type {Observable<[string]>}
 */
export const connected = connected$.asObservable()

/**
 * Emits player id of the last connected player
 * @type {Observable<string>}
 */
export const lastConnected = lastConnected$.asObservable()

/**
 * Configures communication channels (WebSocket and WebRTC) in order to
 * honor other players' connection requests
 * @async
 * @param {object} playerData - current player, containing:
 * @param {string}  playerData.id - player id
 * // TODO url
 */
export async function startAccepting(playerData) {
  player = playerData
  logger.info({ player }, 'initializing peer communication')

  const ws = new WebSocket('ws://localhost:3001/ws')
  return new Promise((resolve, reject) => {
    ws.onopen = function () {
      socket = ws
      createPeer()
      resolve()
    }
    ws.onerror = reject
  })
}

/**
 * Closes all communication channels.
 */
export function closeChannels() {
  for (const { peer } of [...peers.values()]) {
    unwire(peer)
  }
  socket?.close()
  socket = null
  player = null
}

/**
 * Connects with another player, from their id.
 * @async
 * @param {string} playerId - player id to connect with
 * @returns {simple-peer-light.Peer} - connection, in case of success
 * @throws {Error} when no connected peer is matching provided id
 */
export async function connectWith(playerId) {
  if (!socket) return
  logger.info({ to: playerId }, `establishing connection with peer ${playerId}`)
  await createPeer(playerId)
}

/**
 * Sends data to a single peer, or to all peers.
 * Cleans connecte
 * @param {object} data - sent data, no specific structure required
 * @param {string} [to] - targeted player id. Do not provide to broacast data
 */
export function send(data, to = null) {
  lastMessageSent$.next({ data, from: player })
  if (to && !peers.has(to)) {
    return
  }
  const destination = to ? new Map([[to, peers.get(to)]]) : peers
  for (const [playerId, { peer }] of destination) {
    logger.debug({ data, peer }, `sending data to ${playerId}`)
    peer.send(JSON.stringify({ ...data, messageId }))
  }
  messageId++
}
