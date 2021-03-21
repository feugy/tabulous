import Peer from 'peerjs'
import { Subject, BehaviorSubject, merge } from 'rxjs'
import { filter, scan } from 'rxjs/operators'
import { engine as engine$ } from './engine'

let peer

const connections = []

const connectedPeers$ = new BehaviorSubject([])

const incomingMessages$ = new Subject()

const outgoingMessages$ = new Subject()

const currentPeerId$ = new Subject()

function removeConnection(connection) {
  console.log(`${connection.peer} lost!`)
  const idx = connections.indexOf(connection)
  if (idx !== -1) {
    connections.splice(idx, 1)
  }
}

function setupConnection(connection) {
  connection.on('open', () =>
    connection.send({ peers: connections.map(({ peer }) => peer) })
  )
  connection.on('data', data => {
    incomingMessages$.next({ ...data, peer: connection.peer })
  })
  connection.on('error', err =>
    console.log(`${connection.peer} encounter an error:`, err)
  )
  connection.on('close', () => removeConnection(connection))
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
  peer = new Peer(Math.floor(Math.random() * 100000))
  peer.on('connection', setupConnection)
  currentPeerId$.next(peer.id)
}

export async function connectToPeer(id) {
  setupConnection(
    await new Promise((resolve, reject) => {
      const connection = peer.connect(id)
      connection.on('open', () => resolve(connection))
      connection.once('error', reject)
      function receivePeers(data) {
        if (data?.peers) {
          connection.removeListener('data', receivePeers)
          for (const id of data.peers) {
            if (id !== peer.id && connections.every(conn => conn.peer !== id)) {
              connectToPeer(id)
            }
          }
        }
      }
      connection.on('data', receivePeers)
    })
  )
}

export function sendToPeers(data) {
  setTimeout(() => {
    const cleaned = []
    outgoingMessages$.next({ ...data, peer: peer.id })
    for (const connection of connections) {
      if (connection.open) {
        connection.send(data)
      } else {
        cleaned.push(connection)
      }
    }
    if (cleaned.length) {
      cleaned.forEach(removeConnection)
    }
  }, 0)
}
