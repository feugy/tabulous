import { randomUUID } from 'crypto'
import { get } from 'svelte/store'
import WebSocket from 'reconnecting-websocket'
import Peer from 'simple-peer-light'
import * as communication from '@src/stores/peer-channels'
import { mockLogger } from '../utils.js'

jest.mock('reconnecting-websocket')
jest.mock('simple-peer-light')

describe('Peer channels store', () => {
  const logger = mockLogger('peer-channels')
  const player1 = { username: 'Paul', id: 10 }
  const player2 = { username: 'Jack', id: 20 }
  const player3 = { username: 'Gene', id: 30 }
  const webSocket = {
    events: {},
    addEventListener: (event, handler) => {
      if (!webSocket.events[event]) {
        webSocket.events[event] = jest.fn()
      }
      webSocket.events[event](handler)
    },
    send: jest.fn(),
    close: jest.fn()
  }
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
    WebSocket.mockReturnValueOnce(webSocket)
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
    communication.connectWith(player3)
    expect(get(communication.connected)).toEqual([])
    expect(Peer).not.toHaveBeenCalled()
  })

  describe('openChannels()', () => {
    it('opens WebSocket for a given player', async () => {
      webSocket.events.open = jest.fn().mockImplementation(handler => handler())

      await communication.openChannels(player1)
      expect(WebSocket).toHaveBeenCalledWith(
        `ws://localhost/ws?bearer=${player1.id}`
      )
      expect(WebSocket).toHaveBeenCalledTimes(1)
    })

    it('handles WebSocket connection errors', async () => {
      const error = new Error('boom')
      webSocket.events.error = jest
        .fn()
        .mockImplementation(handler => handler(error))

      await expect(
        communication.openChannels({ username: 'Paul', id: 10 })
      ).rejects.toThrow(error)
    })
  })

  describe('given opened channels', () => {
    beforeEach(async () => {
      webSocket.events.open = jest.fn().mockImplementation(handler => handler())
      await communication.openChannels(player1)
    })

    it('opens WebRTC peer when receiving an offer, and sends the answer through WebSocket', async () => {
      const offer = { to: player1, from: player2, signal: { type: 'offer' } }
      const answer = { to: player2, from: player1, signal: { type: 'answer' } }
      expect(Peer).not.toHaveBeenCalled()

      webSocket.events.message.mock.calls[0][0]({
        data: JSON.stringify(offer)
      })
      expect(Peer).toHaveBeenCalledWith(
        expect.objectContaining({ initiator: false, trickle: false })
      )
      expect(peers[0].signal).toHaveBeenCalledWith(offer.signal)

      peers[0].events.signal.mock.calls[0][0](answer.signal)
      expect(webSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'answer', ...answer })
      )

      peers[0].events.connect.mock.calls[0][0]()
      expect(get(communication.connected)).toEqual([
        { player: player1 },
        { player: player2 }
      ])
      expect(Peer).toHaveBeenCalledTimes(1)
      expect(peers[0].events.signal).toHaveBeenCalledTimes(1)
      expect(webSocket.send).toHaveBeenCalledTimes(1)
      expect(lastConnectedId).toEqual(player2.id)
    })

    it('handles unknown WebSocket message', async () => {
      webSocket.events.message.mock.calls[0][0]({
        data: JSON.stringify({
          to: player2,
          from: player1,
          signal: { type: 'unknown' }
        })
      })
      expect(Peer).not.toHaveBeenCalled()
      expect(get(communication.connected)).toEqual([])
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('handles unparseable WebSocket message', async () => {
      webSocket.events.message.mock.calls[0][0]({
        data: 'unparseable'
      })
      expect(Peer).not.toHaveBeenCalled()
      expect(get(communication.connected)).toEqual([])
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ rawData: 'unparseable' }),
        'failed to process data from signaling server'
      )
    })

    describe('connectWith()', () => {
      it('opens WebRTC peer, sends offer through WebSocket and accept answer', async () => {
        const offer = { to: player3, from: player1, signal: { type: 'offer' } }
        const answer = { from: player3, signal: { type: 'answer' } }

        communication.connectWith(player3)
        expect(Peer).toHaveBeenCalledWith(
          expect.objectContaining({ initiator: true, trickle: false })
        )

        peers[0].events.signal.mock.calls[0][0](offer.signal)
        expect(webSocket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'offer', ...offer })
        )

        webSocket.events.message.mock.calls[0][0]({
          data: JSON.stringify(answer)
        })
        peers[0].events.connect.mock.calls[0][0]()
        expect(peers[0].signal).toHaveBeenCalledWith(answer.signal)
        expect(get(communication.connected)).toEqual([
          { player: player1 },
          { player: player3 }
        ])
        expect(Peer).toHaveBeenCalledTimes(1)
        expect(peers[0].signal).toHaveBeenCalledTimes(1)
        expect(webSocket.send).toHaveBeenCalledTimes(1)
        expect(lastConnectedId).toEqual(player3.id)
      })

      it.skip('NEED TIMEOUT does not accept answer for an unknown player', async () => {
        const offer = { to: player3, from: player1, signal: { type: 'offer' } }
        const answer = { from: player2, signal: { type: 'answer' } }

        communication.connectWith(player3)
        expect(Peer).toHaveBeenCalledWith(
          expect.objectContaining({ initiator: true, trickle: false })
        )

        peers[0].events.signal.mock.calls[0][0](offer.signal)
        expect(webSocket.send).toHaveBeenCalledWith(
          JSON.stringify({ type: 'offer', ...offer })
        )

        webSocket.events.message.mock.calls[0][0]({
          data: JSON.stringify(answer)
        })
        expect(get(communication.connected)).toEqual([])
        expect(Peer).toHaveBeenCalledTimes(1)
        expect(peers[0].signal).not.toHaveBeenCalled()
        expect(webSocket.send).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('given connected peers', () => {
    beforeEach(async () => {
      webSocket.events.open = jest.fn().mockImplementation(handler => handler())
      await communication.openChannels(player1)
      webSocket.events.message.mock.calls[0][0]({
        data: JSON.stringify({
          to: player1,
          from: player2,
          signal: { type: 'offer' }
        })
      })
      peers[0].events.connect.mock.calls[0][0]()
      webSocket.events.message.mock.calls[0][0]({
        data: JSON.stringify({
          to: player1,
          from: player3,
          signal: { type: 'offer' }
        })
      })
      peers[1].events.connect.mock.calls[0][0]()
      await Promise.resolve()
      expect(get(communication.connected)).toEqual([
        { player: player1 },
        { player: player2 },
        { player: player3 }
      ])
      expect(peers).toHaveLength(2)
    })

    it('handles peer disconnection', async () => {
      peers[0].events.close.mock.calls[0][0]()
      expect(get(communication.connected)).toEqual([
        { player: player1 },
        { player: player3 }
      ])
      expect(lastDisconnectedId).toEqual(player2.id)
    })

    it('can receive peer stream', () => {
      const stream = randomUUID()
      peers[1].events.stream.mock.calls[0][0](stream)
      expect(get(communication.connected)).toEqual([
        { player: player1 },
        { player: player2 },
        { player: player3, stream }
      ])
    })

    it('logs peer errors', async () => {
      const error = new Error('boom!!')
      peers[0].events.error.mock.calls[0][0](error)
      expect(get(communication.connected)).toEqual([
        { player: player1 },
        { player: player2 },
        { player: player3 }
      ])
      expect(lastDisconnectedId).toBeNull()
      expect(logger.warn).toHaveBeenCalledWith(
        { peer: peers[0], error },
        `peer ${player2.id} encounter an error: ${error.message}`
      )
    })

    it('can receive message', () => {
      const data = { message: randomUUID(), messageId: 1 }
      peers[0].events.data.mock.calls[0][0](JSON.stringify(data))
      expect(messagesReceived).toEqual([{ data, from: player2 }])

      peers[1].events.data.mock.calls[0][0](JSON.stringify(data))
      expect(messagesReceived).toEqual([
        { data, from: player2 },
        { data, from: player3 }
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
        { data: msg1, from: player2 },
        { data: msg2, from: player2 },
        { data: msg3, from: player2 },
        { data: msg4, from: player2 }
      ])
    })

    describe('send()', () => {
      it('sends message to all connected peers', () => {
        const data = { message: randomUUID() }
        const sentData = JSON.stringify({ ...data, messageId: 1 })
        communication.send(data)
        expect(peers[0].send).toHaveBeenCalledWith(sentData)
        expect(peers[1].send).toHaveBeenCalledWith(sentData)
        expect(peers[0].send).toHaveBeenCalledTimes(1)
        expect(peers[1].send).toHaveBeenCalledTimes(1)
        expect(messagesSent).toEqual([{ data, from: player1 }])
      })

      it('sends message to a given peer', () => {
        const data = { content: randomUUID() }
        const sentData = JSON.stringify({ ...data, messageId: 2 })
        communication.send(data, player3.id)
        expect(peers[1].send).toHaveBeenCalledWith(sentData)
        expect(peers[0].send).not.toHaveBeenCalled()
        expect(peers[1].send).toHaveBeenCalledTimes(1)
        expect(messagesSent).toEqual([{ data, from: player1 }])
      })

      it('does not send message to unknown peer', () => {
        const data = { whatever: randomUUID() }
        communication.send(data, 500)
        expect(peers[0].send).not.toHaveBeenCalled()
        expect(peers[1].send).not.toHaveBeenCalled()
        expect(messagesSent).toEqual([{ data, from: player1 }])
      })
    })
  })
})
