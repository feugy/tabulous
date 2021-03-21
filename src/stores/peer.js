import { get } from 'svelte/store'
import Peer from 'peerjs'
import { Subject, BehaviorSubject, merge } from 'rxjs'
import { filter, scan } from 'rxjs/operators'
import { engine as engine$ } from './engine'
import { makeLogger } from '../utils'

const logger = makeLogger('peer')

let peer

const connections = []

const connectedPeers$ = new BehaviorSubject([])

const incomingMessages$ = new Subject()

const outgoingMessages$ = new Subject()

const currentPeerId$ = new Subject()

function removeConnection(connection) {
  logger.info({ connection }, `connection to ${connection.peer} lost!`)
  const idx = connections.indexOf(connection)
  if (idx !== -1) {
    connections.splice(idx, 1)
  }
}

function setupConnection(connection) {
  connection.on('open', () => {
    const peers = connections.map(({ peer }) => peer)
    const scene = get(engine$).serializeScene()
    logger.info(
      { peers, scene, connection },
      `connection established with ${connection.peer}, sending peers and scene`
    )
    connection.send({ peers, scene })
  })
  connection.on('data', data => {
    logger.debug({ data, connection }, `data from ${connection.peer}`)
    incomingMessages$.next({ ...data, peer: connection.peer })
  })
  connection.on('error', error =>
    logger.warn(
      { connection, error },
      `${connection.peer} encounter an error: ${error.message}`
    )
  )
  connection.on('close', () => {
    logger.info({ connection }, `connection to ${connection.peer} closed`)
    removeConnection(connection)
  })
  connections.push(connection)
  connectedPeers$.next([
    ...connectedPeers$.value,
    { name: connection.peer, left: 0, top: 0 }
  ])
}

engine$.subscribe(engine => {
  if (engine) {
    engine.onAction.subscribe(sendToPeers)
    engine.onPointer.subscribe(sendToPeers)
    incomingMessages$.subscribe(data => {
      if (data?.meshId) {
        engine.applyAction(data)
      } else if (data?.pointer) {
        engine.movePeerPointer(data)
      }
    })
  }
})

export const incomingMessages = incomingMessages$.asObservable()

export const currentPeerId = currentPeerId$.asObservable()

export const connectedPeers = connectedPeers$.asObservable()

export const chat = merge(incomingMessages$, outgoingMessages$).pipe(
  filter(data => data.message),
  scan((thread, message) => [...thread, message], [])
)

export function initPeer() {
  for (const connection of connections) {
    removeConnection(connection)
  }
  peer = new Peer(Math.floor(Math.random() * 100000))
  peer.on('connection', setupConnection)
  currentPeerId$.next(peer.id)
  connectedPeers$.next([])
}

export async function connectToPeer(id) {
  setupConnection(
    await new Promise((resolve, reject) => {
      const connection = peer.connect(id)
      connection.on('open', () => {
        logger.info(
          { connection },
          `connection established with ${connection.peer}`
        )
        resolve(connection)
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
            `receiving peers and scene from ${connection.peer}`
          )
          for (const id of data.peers) {
            if (id !== peer.id && connections.every(conn => conn.peer !== id)) {
              connectToPeer(id)
            }
          }
          get(engine$).loadScene(data.scene)
        }
      }
      connection.on('data', receivePeers)
    })
  )
}

export function sendToPeers(data) {
  if (peer) {
    logger.debug({ data, connections }, `sending data to peers`)
    const closed = []
    outgoingMessages$.next({ ...data, peer: peer.id })
    for (const connection of connections) {
      if (connection.open) {
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
