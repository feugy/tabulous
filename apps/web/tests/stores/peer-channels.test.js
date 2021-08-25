import { randomUUID } from 'crypto'
import { get } from 'svelte/store'
import Peer from 'simple-peer-light'
import * as faker from 'faker'
import * as communication from '@src/stores/peer-channels'
import { runMutation, runSubscription } from '@src/stores/graphql-client'
import * as graphQL from '@src/graphql'
import { mockLogger } from '../utils.js'
import { Subject } from 'rxjs'

jest.mock('simple-peer-light')
jest.mock('@src/stores/graphql-client')

describe('Peer channels store', () => {
  const logger = mockLogger('peer-channels')
  const playerId1 = 'Paul'
  const playerId2 = 'Jack'
  const playerId3 = 'Gene'

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
  })

  beforeEach(() => {
    jest.resetAllMocks()
    lastConnectedId = null
    lastDisconnectedId = null
    messagesSent = []
    messagesReceived = []
    Peer.mockImplementation(() => {
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
        destroy: jest.fn()
      }
      peers.push(peer)
      return peer
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

      expect(Peer).toHaveBeenCalledWith(
        expect.objectContaining({ initiator: false, trickle: true })
      )
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
        expect(Peer).toHaveBeenCalledWith(
          expect.objectContaining({ initiator: true, trickle: true })
        )

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
        expect(Peer).toHaveBeenCalledWith(
          expect.objectContaining({ initiator: true, trickle: true })
        )

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
    })

    it('can receive peer stream', () => {
      const stream = randomUUID()
      peers[1].events.stream.mock.calls[0][0](stream)
      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId2 },
        { playerId: playerId3, stream }
      ])
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
})
