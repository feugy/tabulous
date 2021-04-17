import Peer from 'peerjs'
import { BehaviorSubject } from 'rxjs'
import { makeLogger } from '../utils'

const logger = makeLogger('communication')

let peer

const connections = []

const lastMessageSent$ = new BehaviorSubject()

const lastMessageReceived$ = new BehaviorSubject()

const currentPeerId$ = new BehaviorSubject()

const connected$ = new BehaviorSubject(connections)

const lastConnected$ = new BehaviorSubject()

function removeConnection(connection) {
  logger.info({ connection }, `connection to ${connection.peer} lost!`)
  const idx = connections.indexOf(connection)
  if (idx !== -1) {
    connections.splice(idx, 1)
  }
  connected$.next(connections)
}

function setupConnection(connection) {
  connection.on('open', () => {
    const peers = connections.map(({ peer }) => peer)
    logger.info(
      { peers, connection },
      `connection established with ${connection.peer}, sending peers`
    )
    connection.send({ peers })
  })
  connection.on('error', error =>
    logger.warn(
      { connection, error },
      `${connection.peer} encounter an error: ${error.message}`
    )
  )
  connection.on('data', data => {
    logger.debug({ data, connection }, `data from ${connection.peer}`)
    lastMessageReceived$.next({ ...data, peer: connection.peer })
  })
  connection.on('close', () => {
    logger.info({ connection }, `connection to ${connection.peer} closed`)
    removeConnection(connection)
  })
  connections.push(connection)
  connected$.next(connections)
}

export const lastMessageSent = lastMessageSent$.asObservable()

export const lastMessageReceived = lastMessageReceived$.asObservable()

export const currentPeerId = currentPeerId$.asObservable()

export const connected = connected$.asObservable()

export const lastConnected = lastConnected$.asObservable()

export function initCommunication() {
  for (const connection of [...connections]) {
    removeConnection(connection)
  }

  peer = new Peer(Math.floor(Math.random() * 100000))
  peer.on('connection', connection => {
    setupConnection(connection)
    connection.on('open', () => lastConnected$.next(connection))
  })
  currentPeerId$.next(peer.id)
}

export async function connectWith(id, waitForPeers = true) {
  setupConnection(
    await new Promise((resolve, reject) => {
      const connection = peer.connect(id)

      connection.once('open', () => {
        logger.info(
          { connection },
          `connection established with ${connection.peer}`
        )
        if (waitForPeers) {
          connection.on('data', receivePeers)
        } else {
          resolve(connection)
        }
      })

      connection.once('error', error => {
        logger.warn(
          { error, peer: id },
          `failed to connect with ${id}: ${error.message}`
        )
        reject(error)
      })

      function receivePeers(data) {
        if (data?.peers) {
          connection.removeListener('data', receivePeers)
          logger.info(
            { ...data, connection },
            `receiving peers from ${connection.peer}`
          )
          for (const id of data.peers) {
            if (id !== peer.id && connections.every(conn => conn.peer !== id)) {
              connectWith(id, false)
            }
          }
          resolve(connection)
        }
      }
    })
  )
}

export function send(data, to = null) {
  if (peer) {
    const closed = []
    lastMessageSent$.next({ ...data, peer: peer.id })
    for (const connection of to ? [to] : connections) {
      if (connection.open) {
        logger.debug({ data, connection }, `sending data to ${connection.peer}`)
        connection.send(data)
      } else {
        closed.push(connection)
      }
    }
    if (closed.length) {
      for (const connection of closed) {
        removeConnection(connection)
      }
    }
  }
}
