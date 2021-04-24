import Peer from 'peerjs'
import { BehaviorSubject, Subject } from 'rxjs'
import { makeLogger } from '../utils'

const logger = makeLogger('communication')

const storageKey = 'peers'

let peer

const connections = new Map()
const lastMessageSent$ = new Subject()
const lastMessageReceived$ = new Subject()
const connected$ = new BehaviorSubject()
const lastConnected$ = new Subject()

function removeConnection(connection) {
  logger.info({ connection }, `connection to ${connection.peer} lost!`)
  connections.delete(connection.peer)
  connected$.next([...(peer ? [peer.id] : []), ...connections.keys()])
}

function setupConnection(connection) {
  connection.on('open', () => {
    const peers = connected$.value
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
    lastMessageReceived$.next({ data, from: connection.peer })
  })
  connection.on('close', () => {
    logger.info({ connection }, `connection to ${connection.peer} closed`)
    removeConnection(connection)
  })
  connections.set(connection.peer, connection)
  connected$.next([peer.id, ...connections.keys()])
}

connected$.subscribe(peers => {
  if (peers) {
    logger.debug({ peers }, `persisting current peers`)
    sessionStorage.setItem(storageKey, JSON.stringify(peers))
  }
})

export const lastMessageSent = lastMessageSent$.asObservable()

export const lastMessageReceived = lastMessageReceived$.asObservable()

export const connected = connected$.asObservable()

export const lastConnected = lastConnected$.asObservable()

export async function initCommunication(id) {
  logger.info({ id }, `initializing communication`)
  const previousPeers = sessionStorage.getItem(storageKey)
  for (const connection of [...connections]) {
    removeConnection(connection)
  }

  peer = new Peer(id, { debug: 3 })
  peer.on('connection', connection => {
    setupConnection(connection)
    connection.on('open', () => lastConnected$.next(connection.peer))
  })
  connected$.next([peer.id])
  if (previousPeers) {
    logger.debug({ previousPeers }, `try to reconnect with previous peers...`)
    try {
      const [previousId, ...peers] = JSON.parse(previousPeers)
      if (previousId === id) {
        for (const peer of peers) {
          console.log(connections.has(peer), peer)
          await connectWith(peer, false)
        }
      }
    } catch (error) {
      logger.warn(
        { error, previousPeers },
        `can not reconnect with previous peers: ${error.message}`
      )
    }
  }
}

export async function connectWith(id, waitForPeers = true) {
  if (!peer || connections.has(id)) return
  setupConnection(
    await new Promise((resolve, reject) => {
      const connection = peer.connect(id)
      logger.info(
        { peer: id, waitForPeers },
        `establishing connection with peer ${id}`
      )

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
          for (const peer of data.peers) {
            if (connections.has(peer)) {
              connectWith(peer, false)
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
    lastMessageSent$.next({ data, from: peer.id })
    if (to && !connections.has(to)) {
      return
    }
    const destination = to ? new Map([[to, connections.get(to)]]) : connections
    for (const [, connection] of destination) {
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
