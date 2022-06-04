import { faker } from '@faker-js/faker'
import { randomUUID } from 'crypto'
import { Subject } from 'rxjs'
import { get } from 'svelte/store'
import Peer from 'simple-peer-light'
import * as graphQL from '../../src/graphql'
import * as communication from '../../src/stores/peer-channels'
import { turnCredentials as turnCredentials$ } from '../../src/stores/players'
import {
  acquireMediaStream,
  releaseMediaStream,
  stream$
} from '../../src/stores/stream'
import { runMutation, runSubscription } from '../../src/stores/graphql-client'
import { mockLogger } from '../utils.js'

jest.mock('simple-peer-light')
jest.mock('../../src/stores/graphql-client')
jest.mock('../../src/stores/players', () => {
  const { BehaviorSubject } = require('rxjs')
  return { turnCredentials: new BehaviorSubject() }
})
jest.mock('../../src/stores/stream', () => {
  const { BehaviorSubject } = require('rxjs')
  return {
    stream$: new BehaviorSubject(null),
    acquireMediaStream: jest.fn(),
    releaseMediaStream: jest.fn()
  }
})

describe('Peer channels store', () => {
  const logger = mockLogger('peer-channels')
  const playerId1 = 'Paul'
  const playerId2 = 'Jack'
  const playerId3 = 'Gene'
  const turnCredentials = {
    username: faker.lorem.words(),
    credentials: faker.datatype.uuid()
  }
  const stream = faker.datatype.uuid()

  let peers = []
  let subscriptions = []
  let lastConnectedId
  let lastDisconnectedId
  let messagesSent = []
  let messagesReceived = []

  beforeAll(() => {
    subscriptions = [
      communication.lastConnectedId.subscribe(value => {
        lastConnectedId = value
      }),
      communication.lastDisconnectedId.subscribe(value => {
        lastDisconnectedId = value
      }),
      communication.lastMessageSent.subscribe(value => {
        messagesSent.push(value)
      }),
      communication.lastMessageReceived.subscribe(value => {
        messagesReceived.push(value)
      })
    ]
    turnCredentials$.next(turnCredentials)
  })

  beforeEach(() => {
    jest.resetAllMocks()
    lastConnectedId = null
    lastDisconnectedId = null
    messagesSent = []
    messagesReceived = []
    Peer.mockImplementation(({ stream } = {}) => {
      const peer = {
        id: randomUUID(),
        events: {},
        on: (event, handler) => {
          if (!peer.events[event]) {
            peer.events[event] = jest.fn()
          }
          peer.events[event](handler)
        },
        signal: jest.fn(),
        send: jest.fn(),
        destroy: jest.fn(),
        addStream: jest.fn(),
        removeStream: jest.fn(),
        streams: [stream]
      }
      peers.push(peer)
      return peer
    })
    acquireMediaStream.mockImplementation(async () => {
      stream$.next(stream)
    })
  })

  afterEach(async () => {
    communication.closeChannels()
    peers = []
  })

  afterAll(() => subscriptions.forEach(sub => sub.unsubscribe()))

  it('can not connect with peer until WebSocket is open', () => {
    communication.connectWith(playerId3)
    expect(get(communication.connected)).toEqual([])
    expect(Peer).not.toHaveBeenCalled()
  })

  it('starts subscription for a given player', async () => {
    runSubscription.mockReturnValueOnce(new Subject())
    communication.openChannels({ id: playerId1 })
    expect(runSubscription).toHaveBeenCalledWith(graphQL.awaitSignal)
    expect(runSubscription).toHaveBeenCalledTimes(1)
  })

  describe('given opened channels', () => {
    const awaitSignal = new Subject()

    beforeEach(() => {
      runSubscription.mockReturnValueOnce(awaitSignal)
      communication.openChannels({ id: playerId1 })
    })

    it('opens WebRTC peer when receiving an offer, and sends the answer through mutation', async () => {
      const offer = {
        type: 'offer',
        from: playerId2,
        signal: faker.lorem.words()
      }
      const answer = { type: 'answer', data: faker.lorem.words() }
      expect(Peer).not.toHaveBeenCalled()

      await awaitSignal.next(offer)

      expectPeerOptions(false)
      expect(peers[0].signal).toHaveBeenCalledWith(offer.signal)

      peers[0].events.signal.mock.calls[0][0](answer)
      expect(runMutation).toHaveBeenCalledWith(graphQL.sendSignal, {
        signal: {
          type: 'answer',
          to: offer.from,
          signal: JSON.stringify(answer)
        }
      })

      peers[0].events.connect.mock.calls[0][0]()
      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId2 }
      ])
      expect(lastConnectedId).toEqual(playerId2)
      expect(Peer).toHaveBeenCalledTimes(1)
      expect(peers[0].events.signal).toHaveBeenCalledTimes(1)
      expect(runMutation).toHaveBeenCalledTimes(1)
    })

    describe('connectWith()', () => {
      beforeEach(jest.useFakeTimers)

      afterEach(jest.useRealTimers)

      it('opens WebRTC peer, sends offer through WebSocket and accept answer', async () => {
        const offer = { type: 'offer', data: faker.lorem.words() }
        const answer = {
          type: 'answer',
          from: playerId3,
          signal: faker.lorem.words()
        }

        const connectWith = communication.connectWith(playerId3)
        await Promise.resolve()
        expectPeerOptions()

        peers[0].events.signal.mock.calls[0][0](offer)
        expect(runMutation).toHaveBeenCalledWith(graphQL.sendSignal, {
          signal: {
            type: 'offer',
            to: playerId3,
            signal: JSON.stringify(offer)
          }
        })

        await awaitSignal.next(answer)

        peers[0].events.connect.mock.calls[0][0]()
        expect(peers[0].signal).toHaveBeenCalledWith(answer.signal)
        expect(get(communication.connected)).toEqual([
          { playerId: playerId1 },
          { playerId: playerId3 }
        ])
        expect(Peer).toHaveBeenCalledTimes(1)
        expect(peers[0].signal).toHaveBeenCalledTimes(1)
        expect(runMutation).toHaveBeenCalledTimes(1)
        expect(lastConnectedId).toEqual(playerId3)
        await expect(connectWith).resolves.toEqual(peers[0])
      })

      it('does not accept answer for an unknown player', async () => {
        const offer = { type: 'offer', data: faker.lorem.words() }
        const answer = {
          type: 'answer',
          from: playerId2,
          signal: faker.lorem.words()
        }

        const connectWith = communication.connectWith(playerId3)
        await Promise.resolve()
        expectPeerOptions()

        peers[0].events.signal.mock.calls[0][0](offer)
        expect(runMutation).toHaveBeenCalledWith(graphQL.sendSignal, {
          signal: {
            type: 'offer',
            to: playerId3,
            signal: JSON.stringify(offer)
          }
        })

        await awaitSignal.next(answer)

        jest.runAllTimers()
        expect(get(communication.connected)).toEqual([])
        expect(Peer).toHaveBeenCalledTimes(1)
        expect(peers[0].signal).not.toHaveBeenCalled()
        expect(runMutation).toHaveBeenCalledTimes(1)
        await expect(connectWith).rejects.toThrow(
          /Failed to establish connection/
        )
      })
    })
  })

  describe('given connected peers', () => {
    const awaitSignal = new Subject()

    beforeEach(async () => {
      runSubscription.mockReturnValueOnce(awaitSignal)
      communication.openChannels({ id: playerId1 })

      await awaitSignal.next({ type: 'offer', from: playerId2 })
      peers[0].events.signal.mock.calls[0][0]({ type: 'answer' })
      peers[0].events.connect.mock.calls[0][0]()

      await awaitSignal.next({ type: 'offer', from: playerId3 })
      peers[1].events.signal.mock.calls[0][0]({ type: 'answer' })
      peers[1].events.connect.mock.calls[0][0]()

      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId2 },
        { playerId: playerId3 }
      ])
      expect(peers).toHaveLength(2)
    })

    it('handles peer disconnection', async () => {
      peers[0].events.close.mock.calls[0][0]()
      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId3 }
      ])
      expect(lastDisconnectedId).toEqual(playerId2)
      expect(releaseMediaStream).not.toHaveBeenCalled()
    })

    it('releases media stream when all peers are gone', async () => {
      peers[0].events.close.mock.calls[0][0]()
      expect(lastDisconnectedId).toEqual(playerId2)
      peers[1].events.close.mock.calls[0][0]()
      expect(lastDisconnectedId).toEqual(playerId3)
      expect(get(communication.connected)).toEqual([])
      expect(releaseMediaStream).toHaveBeenCalledTimes(1)
    })

    it('can receive peer stream', () => {
      const peerStream = randomUUID()
      peers[1].events.stream.mock.calls[0][0](peerStream)
      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId2 },
        { playerId: playerId3, stream: peerStream }
      ])
    })

    it('can change local stream', async () => {
      const [peer1, peer2] = peers
      const newStream = faker.datatype.uuid()
      await stream$.next(newStream)
      expect(peer1.addStream).toHaveBeenCalledWith(newStream)
      expect(peer2.addStream).toHaveBeenCalledWith(newStream)
    })

    it('logs peer errors', async () => {
      const error = new Error('boom!!')
      peers[0].events.error.mock.calls[0][0](error)
      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId2 },
        { playerId: playerId3 }
      ])
      expect(lastDisconnectedId).toBeNull()
      expect(logger.warn).toHaveBeenCalledWith(
        { peer: peers[0], error },
        `peer ${playerId2} encounter an error: ${error.message}`
      )
    })

    it('can receive message', () => {
      const data = { message: randomUUID(), messageId: 1 }
      peers[0].events.data.mock.calls[0][0](JSON.stringify(data))
      expect(messagesReceived).toEqual([{ data, playerId: playerId2 }])

      peers[1].events.data.mock.calls[0][0](JSON.stringify(data))
      expect(messagesReceived).toEqual([
        { data, playerId: playerId2 },
        { data, playerId: playerId3 }
      ])
    })

    it('reorders received message', async () => {
      const msg1 = { message: randomUUID(), messageId: 1 }
      const msg2 = { message: randomUUID(), messageId: 2 }
      const msg3 = { message: randomUUID(), messageId: 3 }
      const msg4 = { message: randomUUID(), messageId: 4 }
      peers[0].events.data.mock.calls[0][0](JSON.stringify(msg1))
      peers[0].events.data.mock.calls[0][0](JSON.stringify(msg4))
      peers[0].events.data.mock.calls[0][0](JSON.stringify(msg2))
      peers[0].events.data.mock.calls[0][0](JSON.stringify(msg3))
      expect(messagesReceived).toEqual([
        { data: msg1, playerId: playerId2 },
        { data: msg2, playerId: playerId2 },
        { data: msg3, playerId: playerId2 },
        { data: msg4, playerId: playerId2 }
      ])
    })

    it('sends message to all connected peers', () => {
      const data = { message: randomUUID() }
      const sentData = JSON.stringify({ ...data, messageId: 1 })
      communication.send(data)
      expect(peers[0].send).toHaveBeenCalledWith(sentData)
      expect(peers[1].send).toHaveBeenCalledWith(sentData)
      expect(peers[0].send).toHaveBeenCalledTimes(1)
      expect(peers[1].send).toHaveBeenCalledTimes(1)
      expect(messagesSent).toEqual([{ data, playerId: playerId1 }])
    })

    it('sends message to a given peer', () => {
      const data = { content: randomUUID() }
      const sentData = JSON.stringify({ ...data, messageId: 2 })
      communication.send(data, playerId3)
      expect(peers[1].send).toHaveBeenCalledWith(sentData)
      expect(peers[0].send).not.toHaveBeenCalled()
      expect(peers[1].send).toHaveBeenCalledTimes(1)
      expect(messagesSent).toEqual([{ data, playerId: playerId1 }])
    })

    it('does not send message to unknown peer', () => {
      const data = { whatever: randomUUID() }
      communication.send(data, 500)
      expect(peers[0].send).not.toHaveBeenCalled()
      expect(peers[1].send).not.toHaveBeenCalled()
      expect(messagesSent).toEqual([])
    })
  })

  function expectPeerOptions(initiator = true) {
    expect(Peer).toHaveBeenCalledWith(
      expect.objectContaining({
        initiator,
        stream,
        trickle: true,
        config: {
          iceServers: [
            { urls: ['stun:tabulous.fr'] },
            {
              urls: ['turn:tabulous.fr'],
              username: turnCredentials.username,
              credential: turnCredentials.credentials
            }
          ]
        }
      })
    )
    expect(Peer).toHaveBeenCalledTimes(1)
  }
})
