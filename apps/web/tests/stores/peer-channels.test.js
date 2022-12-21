import { faker } from '@faker-js/faker'
import * as graphQL from '@src/graphql'
import { runMutation, runSubscription } from '@src/stores/graphql-client'
import * as communication from '@src/stores/peer-channels'
import {
  acquireMediaStream,
  localStreamChange$,
  releaseMediaStream,
  stream$
} from '@src/stores/stream'
import { PeerConnection, sleep } from '@src/utils'
import { mockLogger } from '@tests/test-utils'
import { randomUUID } from 'crypto'
import EventEmitter, { once } from 'events'
import { Subject } from 'rxjs'
import { get } from 'svelte/store'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

let peers = []

vi.mock('@src/utils/peer-connection', () => {
  const PeerConnection = vi.fn().mockImplementation(function (options) {
    Object.assign(this, options)
    this.local = {}
    this.remote = {}
    this.lastMessageId = 0
    peers.push(this)
    this.handleSignal = vi.fn()
    this.attachLocalStream = vi
      .fn()
      .mockImplementation(stream => (this.local.stream = stream))
    this.setLocalState = vi
      .fn()
      .mockImplementation(state => Object.assign(this.local, state))
    this.hasLocalStream = vi.fn().mockImplementation(() => !!this.local.stream)
    this.setRemote = vi
      .fn()
      .mockImplementation(options => Object.assign(this.remote, options))
    this.sendData = vi.fn()
    this.destroy = vi.fn()
    // we need to break references in order to assert passed `local`
    const {
      mock: { calls }
    } = PeerConnection
    const lastCallArg = calls[calls.length - 1][0]
    calls[calls.length - 1][0] = JSON.parse(JSON.stringify(lastCallArg))
    return this
  })

  PeerConnection.prototype.connect = vi.fn()
  return { PeerConnection }
})

vi.mock('@src/stores/graphql-client')
vi.mock('@src/stores/stream', () => {
  const { BehaviorSubject, Subject } = require('rxjs')
  return {
    stream$: new BehaviorSubject(null),
    acquireMediaStream: vi.fn(),
    releaseMediaStream: vi.fn(),
    localStreamChange$: new Subject()
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
  const gameId = faker.datatype.uuid()

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
    vi.clearAllMocks()
    lastConnectedId = null
    lastDisconnectedId = null
    messagesSent = []
    messagesReceived = []
    acquireMediaStream.mockImplementation(async () => {
      stream$.next(stream)
      return stream
    })
  })

  afterEach(async () => {
    communication.closeChannels()
    peers = []
  })

  afterAll(() => subscriptions.forEach(sub => sub.unsubscribe()))

  it('can not connect with peer until WebSocket is open', () => {
    communication.connectWith(playerId3, turnCredentials)
    expect(get(communication.connected)).toEqual([])
    expect(PeerConnection).not.toHaveBeenCalled()
  })

  it('starts subscription for a given player', async () => {
    let done = false
    const awaitSignal = new Subject()
    runSubscription.mockReturnValueOnce(awaitSignal)
    const openPromise = communication
      .openChannels({ id: playerId1 }, turnCredentials, gameId)
      .then(() => (done = true))
    expect(done).toBe(false)
    awaitSignal.next({ data: JSON.stringify({ type: 'ready' }) })
    await openPromise
    expect(done).toBe(true)
    expect(runSubscription).toHaveBeenCalledWith(graphQL.awaitSignal, {
      gameId
    })
    expect(runSubscription).toHaveBeenCalledTimes(1)
    expect(acquireMediaStream).not.toHaveBeenCalled()
  })

  describe('given opened channels', () => {
    const awaitSignal = new Subject()

    beforeEach(() => {
      stream$.next(null)
      runSubscription.mockReturnValueOnce(awaitSignal)
      communication.openChannels({ id: playerId1 }, turnCredentials, gameId)
    })

    it('opens WebRTC peer when receiving an offer, and sends the answer through mutation', async () => {
      const offer = { type: 'offer', data: faker.lorem.words() }
      const candidate = { data: `candidate-${faker.lorem.words()}` }
      const answer = { type: 'answer', data: faker.lorem.words() }
      expect(PeerConnection).not.toHaveBeenCalled()
      const emitter = new EventEmitter()
      PeerConnection.prototype.connect.mockImplementationOnce(async function (
        playerId
      ) {
        this.playerId = playerId
        this.sendSignal(playerId, answer)
        this.handleSignal.mockImplementation((...args) =>
          this.sendSignal(playerId, ...args)
        )
        await once(emitter, 'ready')
        this.established = true
      })

      awaitSignal.next({
        from: playerId2,
        data: JSON.stringify(offer)
      })
      awaitSignal.next({
        from: playerId2,
        data: JSON.stringify(candidate)
      })

      expect(acquireMediaStream).not.toHaveBeenCalled()
      emitter.emit('ready')
      await sleep()

      expect(peers[0].connect).toHaveBeenCalledWith(playerId2, offer)

      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId2 }
      ])
      expect(lastConnectedId).toEqual(playerId2)
      expectPeerOptions()
      expect(runMutation).toHaveBeenCalledWith(graphQL.sendSignal, {
        signal: {
          to: playerId2,
          data: JSON.stringify(answer)
        }
      })
      expect(runMutation).toHaveBeenCalledWith(graphQL.sendSignal, {
        signal: {
          to: playerId2,
          data: JSON.stringify(candidate)
        }
      })
      expect(runMutation).toHaveBeenCalledTimes(2)
      expect(acquireMediaStream).toHaveBeenCalledTimes(1)
      expect(peers[0].attachLocalStream).toHaveBeenCalledWith(stream)
      expect(peers[0].attachLocalStream).toHaveBeenCalledTimes(1)
    })

    it('reports errors during peer connection', async () => {
      const offer = { type: 'offer', data: faker.lorem.words() }
      const error = new Error('boom')
      PeerConnection.prototype.connect.mockRejectedValueOnce(error)

      awaitSignal.next({
        from: playerId3,
        data: JSON.stringify(offer)
      })
      await sleep()

      expect(acquireMediaStream).not.toHaveBeenCalled()
      expect(peers[0].connect).toHaveBeenCalledWith(playerId3, offer)

      expect(get(communication.connected)).toEqual([])
      expectPeerOptions()
      expect(runMutation).not.toHaveBeenCalled()
      expect(acquireMediaStream).not.toHaveBeenCalled()
    })

    it('cleans up on peer disconnection', async () => {
      const offer = { type: 'offer', data: faker.lorem.words() }
      PeerConnection.prototype.connect.mockImplementationOnce(async function (
        playerId
      ) {
        this.playerId = playerId
        this.established = true
      })

      awaitSignal.next({
        from: playerId2,
        data: JSON.stringify(offer)
      })
      await sleep()

      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId2 }
      ])
      expect(lastConnectedId).toEqual(playerId2)

      peers[0].onClose()

      expect(get(communication.connected)).toEqual([])
      expect(lastDisconnectedId).toEqual(playerId2)

      expect(runMutation).not.toHaveBeenCalled()
      expect(acquireMediaStream).toHaveBeenCalledTimes(1)
    })

    describe('connectWith()', () => {
      it('opens WebRTC peer, sends offer through WebSocket and accept answer', async () => {
        const offer = { type: 'offer', data: faker.lorem.words() }
        const emitter = new EventEmitter()
        PeerConnection.prototype.connect.mockImplementationOnce(async function (
          playerId
        ) {
          this.playerId = playerId
          this.sendSignal(playerId, offer)
          await once(emitter, 'ready')
          this.established = true
        })

        const connectWith = communication.connectWith(
          playerId3,
          turnCredentials
        )
        await sleep()
        expectPeerOptions({ stream, muted: false, stopped: false })

        expect(runMutation).toHaveBeenCalledWith(graphQL.sendSignal, {
          signal: {
            to: playerId3,
            data: JSON.stringify(offer)
          }
        })

        expect(acquireMediaStream).toHaveBeenCalled()
        emitter.emit('ready')
        await expect(connectWith).resolves.toEqual(peers[0])

        expect(get(communication.connected)).toEqual([
          { playerId: playerId1 },
          { playerId: playerId3 }
        ])
        expect(runMutation).toHaveBeenCalledTimes(1)
        expect(lastConnectedId).toEqual(playerId3)
        expect(acquireMediaStream).toHaveBeenCalledTimes(1)
      })

      it('propagates connection errors', async () => {
        const error = new Error('boom')
        PeerConnection.prototype.connect.mockRejectedValueOnce(error)

        await expect(
          communication.connectWith(playerId3, turnCredentials)
        ).rejects.toThrow(error)

        expect(get(communication.connected)).toEqual([])
        expect(runMutation).not.toHaveBeenCalled()
        expect(acquireMediaStream).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('given connected peers', () => {
    const awaitSignal = new Subject()

    beforeEach(async () => {
      runSubscription.mockReturnValueOnce(awaitSignal)
      expect(get(communication.connected)).toEqual([])
      PeerConnection.prototype.connect.mockImplementation(async function (
        playerId
      ) {
        this.playerId = playerId
        this.established = true
      })
      let openPromise = communication.openChannels(
        { id: playerId1 },
        turnCredentials,
        gameId
      )
      awaitSignal.next({ data: JSON.stringify({ type: 'ready' }) })
      await openPromise
      await communication.connectWith(playerId2, turnCredentials)
      await communication.connectWith(playerId3, turnCredentials)

      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId2 },
        { playerId: playerId3 }
      ])
      expect(peers).toHaveLength(2)
    })

    it('handles peer disconnection', async () => {
      peers[0].onClose()
      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId3 }
      ])
      expect(lastDisconnectedId).toEqual(playerId2)
      expect(releaseMediaStream).not.toHaveBeenCalled()
    })

    it('releases media stream when all peers are gone', async () => {
      peers[0].onClose()
      expect(lastDisconnectedId).toEqual(playerId2)
      peers[1].onClose()
      expect(lastDisconnectedId).toEqual(playerId3)
      expect(get(communication.connected)).toEqual([])
      expect(releaseMediaStream).toHaveBeenCalledTimes(1)
    })

    it('can receive peer stream', async () => {
      const peerStream = randomUUID()
      peers[1].onRemoteStream(peerStream)
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
      expect(peer1.attachLocalStream).toHaveBeenCalledWith(newStream)
      expect(peer2.attachLocalStream).toHaveBeenCalledWith(newStream)
    })

    it('can receive message', () => {
      const data = { message: randomUUID(), messageId: 1 }
      peers[0].onData(data)
      expect(messagesReceived).toEqual([{ data, playerId: playerId2 }])

      peers[1].onData(data)
      expect(messagesReceived).toEqual([
        { data, playerId: playerId2 },
        { data, playerId: playerId3 }
      ])
    })

    it.skip('can receive stream state changes', () => {
      const state1 = { muted: true, stopped: faker.datatype.boolean() }
      const state2 = { muted: false, stopped: faker.datatype.boolean() }
      peers[0].onData({ type: 'control', state: state1, messageId: 1 })
      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId2, ...state1 },
        { playerId: playerId3 }
      ])
      peers[1].onData({ type: 'control', state: state2, messageId: 1 })
      expect(messagesReceived).toEqual([])
      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId2, ...state1 },
        { playerId: playerId3, ...state2 }
      ])
    })

    it('reorders received message', async () => {
      logger.error.mockImplementation(() => {})
      const msg1 = { message: randomUUID(), messageId: 1 }
      const msg2 = { message: randomUUID(), messageId: 2 }
      const msg3 = { message: randomUUID(), messageId: 3 }
      const msg4 = { message: randomUUID(), messageId: 4 }
      peers[0].onData(msg1)
      peers[0].onData(msg4)
      peers[0].onData(msg2)
      peers[0].onData(msg3)
      expect(messagesReceived).toEqual([
        { data: msg1, playerId: playerId2 },
        { data: msg2, playerId: playerId2 },
        { data: msg3, playerId: playerId2 },
        { data: msg4, playerId: playerId2 }
      ])
    })

    it('sends message to all connected peers', () => {
      const data = { message: randomUUID() }
      const sentData = { ...data, messageId: expect.any(Number) }
      communication.send(data)
      expect(peers[0].sendData).toHaveBeenCalledWith(sentData)
      expect(peers[0].sendData).toHaveBeenCalledTimes(1)
      expect(peers[1].sendData).toHaveBeenCalledWith(sentData)
      expect(peers[1].sendData).toHaveBeenCalledTimes(1)
      expect(messagesSent).toEqual([{ data, playerId: playerId1 }])
    })

    it('sends message to a given peer', () => {
      const data = { content: randomUUID() }
      const sentData = { ...data, messageId: expect.any(Number) }
      communication.send(data, playerId3)
      expect(peers[0].sendData).not.toHaveBeenCalled()
      expect(peers[1].sendData).toHaveBeenCalledWith(sentData)
      expect(peers[1].sendData).toHaveBeenCalledTimes(1)
      expect(messagesSent).toEqual([{ data, playerId: playerId1 }])
    })

    it('cleans up disconnected peer on data sending', async () => {
      peers[0].sendData.mockImplementationOnce(() => {
        throw new Error('boom!!!')
      })
      const data = { content: randomUUID() }
      const sentData = { ...data, messageId: expect.any(Number) }
      communication.send(data)
      expect(peers[0].sendData).toHaveBeenCalledWith(sentData)
      expect(peers[0].sendData).toHaveBeenCalledTimes(1)
      expect(peers[1].sendData).toHaveBeenCalledWith(sentData)
      expect(peers[1].sendData).toHaveBeenCalledTimes(1)
      expect(messagesSent).toEqual([{ data, playerId: playerId1 }])
      expect(get(communication.connected)).toEqual([
        { playerId: playerId1 },
        { playerId: playerId3 }
      ])
      expect(lastDisconnectedId).toEqual(peers[0].playerId)
      expect(releaseMediaStream).not.toHaveBeenCalled()
    })

    it.skip('sends local media state updates to all', async () => {
      const state = {
        muted: faker.datatype.boolean(),
        stopped: faker.datatype.boolean()
      }
      const sentData = {
        type: 'control',
        state,
        messageId: expect.any(Number)
      }
      localStreamChange$.next(state)
      await sleep(50)
      expect(peers[0].sendData).toHaveBeenCalledWith(sentData)
      expect(peers[0].sendData).toHaveBeenCalledTimes(1)
      expect(peers[1].sendData).toHaveBeenCalledWith(sentData)
      expect(peers[1].sendData).toHaveBeenCalledTimes(1)
      expect(messagesSent).toEqual([])
    })

    it('does not send message to unknown peer', () => {
      const data = { whatever: randomUUID() }
      communication.send(data, 500)
      expect(peers[0].sendData).not.toHaveBeenCalled()
      expect(peers[1].sendData).not.toHaveBeenCalled()
      expect(messagesSent).toEqual([])
    })
  })

  function expectPeerOptions(
    local = { stream: null, muted: false, stopped: false }
  ) {
    expect(PeerConnection).toHaveBeenCalledWith(
      expect.objectContaining({ turnCredentials, local })
    )
    expect(PeerConnection).toHaveBeenCalledTimes(1)
  }
})
