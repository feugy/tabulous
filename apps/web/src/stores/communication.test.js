import { randomUUID } from 'crypto'
import { get } from 'svelte/store'
import Peer from 'peerjs'
import * as communication from './communication'
import { makeLogger } from '../utils'

jest.mock('peerjs')

const openForPeersIdx = 0
const errorIdx = 1
const dataIdx = 2
const closeIdx = 3
const openForLastConnectedIdx = 4

describe('Communication store', () => {
  const logger = makeLogger('communication')
  let peer
  let handleConnection

  beforeEach(() => {
    jest.resetAllMocks()
    peer = { id: randomUUID(), on: jest.fn(), connect: jest.fn() }
    Peer.mockReturnValueOnce(peer)
    communication.initCommunication()

    expect(get(communication.connected)).toEqual([])
    expect(peer.on).toHaveBeenNthCalledWith(
      1,
      'connection',
      expect.any(Function)
    )
    handleConnection = peer.on.mock.calls[openForPeersIdx][1]
  })

  afterEach(() => {
    for (const connection of [...get(communication.connected)]) {
      connection.on.mock.calls[closeIdx][1]()
    }
  })

  it('can not send data without initialized connection', () => {
    expect(get(communication.connected)).toEqual([])
    communication.send(randomUUID())
    expect(get(communication.connected)).toEqual([])
  })

  describe('initConnection()', () => {
    it('can receive incoming connections', () => {
      const connection1 = { peer: randomUUID(), on: jest.fn() }
      handleConnection(connection1)

      expect(connection1.on).toHaveBeenNthCalledWith(
        openForPeersIdx + 1,
        'open',
        expect.any(Function)
      )
      expect(connection1.on).toHaveBeenNthCalledWith(
        errorIdx + 1,
        'error',
        expect.any(Function)
      )
      expect(connection1.on).toHaveBeenNthCalledWith(
        dataIdx + 1,
        'data',
        expect.any(Function)
      )
      expect(connection1.on).toHaveBeenNthCalledWith(
        closeIdx + 1,
        'close',
        expect.any(Function)
      )
      expect(connection1.on).toHaveBeenNthCalledWith(
        openForLastConnectedIdx + 1,
        'open',
        expect.any(Function)
      )
      expect(connection1.on).toHaveBeenCalledTimes(openForLastConnectedIdx + 1)

      expect(get(communication.connected)).toEqual([connection1])

      const connection2 = { peer: randomUUID(), on: jest.fn() }
      handleConnection(connection2)

      expect(get(communication.connected)).toEqual([connection1, connection2])
      expect(peer.on).toHaveBeenCalledTimes(1)
      expect(get(communication.currentPeerId)).toEqual(peer.id)
    })

    it('sends peers to new connections, and updates last connected', () => {
      const connection = { peer: randomUUID(), on: jest.fn(), send: jest.fn() }
      handleConnection(connection)

      let [, handleOpen] = connection.on.mock.calls[openForPeersIdx]
      handleOpen()
      expect(connection.send).toHaveBeenCalledWith({ peers: [connection.peer] })
      expect(connection.send).toHaveBeenCalledTimes(1)

      handleOpen = connection.on.mock.calls[openForLastConnectedIdx][1]
      handleOpen()
      expect(get(communication.lastConnected)).toEqual(connection)
    })

    it('handles connection loss', () => {
      const connection = { peer: randomUUID(), on: jest.fn() }
      handleConnection(connection)

      expect(get(communication.connected)).toEqual([connection])

      const [, handleClose] = connection.on.mock.calls[closeIdx]
      handleClose()
      expect(get(communication.connected)).toEqual([])
    })

    it('logs connections errors', () => {
      const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})

      const connection = { peer: randomUUID(), on: jest.fn() }
      handleConnection(connection)

      expect(get(communication.connected)).toEqual([connection])

      const [, handleError] = connection.on.mock.calls[errorIdx]
      const error = new Error('boom!')
      expect(get(communication.connected)).toEqual([connection])

      handleError(error)

      expect(warn).toHaveBeenCalledWith(
        { connection, error },
        expect.any(String)
      )
      expect(warn).toHaveBeenCalledTimes(1)
    })
  })

  describe('connectWith()', () => {
    it('can connect with another peer', async () => {
      const connection = {
        peer: randomUUID(),
        once: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn()
      }

      peer.connect.mockReturnValueOnce(connection)
      const promise = communication.connectWith(peer.id)

      expect(connection.once).toHaveBeenNthCalledWith(
        openForPeersIdx + 1,
        'open',
        expect.any(Function)
      )
      expect(connection.once).toHaveBeenNthCalledWith(
        errorIdx + 1,
        'error',
        expect.any(Function)
      )

      const [, handleOpen] = connection.once.mock.calls[openForPeersIdx]
      handleOpen()
      expect(connection.on).toHaveBeenNthCalledWith(
        1,
        'data',
        expect.any(Function)
      )

      const [, handleData] = connection.on.mock.calls[0]
      handleData({ peers: [] })
      expect(connection.removeListener).toHaveBeenNthCalledWith(
        1,
        'data',
        handleData
      )
      await expect(promise).resolves.not.toBeDefined()
      expect(connection.on).toHaveBeenNthCalledWith(
        openForPeersIdx + 2,
        'open',
        expect.any(Function)
      )
      expect(connection.on).toHaveBeenNthCalledWith(
        errorIdx + 2,
        'error',
        expect.any(Function)
      )
      expect(connection.on).toHaveBeenNthCalledWith(
        dataIdx + 2,
        'data',
        expect.any(Function)
      )
      expect(connection.on).toHaveBeenNthCalledWith(
        closeIdx + 2,
        'close',
        expect.any(Function)
      )
      expect(connection.on).toHaveBeenCalledTimes(closeIdx + 2)
    })

    it('connects to all other peers when receiving them', async () => {
      const connection1 = {
        peer: randomUUID(),
        once: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn()
      }
      const connection2 = { peer: randomUUID(), once: jest.fn(), on: jest.fn() }
      const connection3 = { peer: randomUUID(), once: jest.fn(), on: jest.fn() }

      peer.connect
        .mockReturnValueOnce(connection1)
        .mockReturnValueOnce(connection2)
        .mockReturnValueOnce(connection3)
      const promise = communication.connectWith(peer.id)

      expect(connection1.once).toHaveBeenNthCalledWith(
        openForPeersIdx + 1,
        'open',
        expect.any(Function)
      )
      expect(connection1.once).toHaveBeenNthCalledWith(
        errorIdx + 1,
        'error',
        expect.any(Function)
      )

      const [, handleOpenConnection1] = connection1.once.mock.calls[
        openForPeersIdx
      ]
      handleOpenConnection1()
      expect(connection1.on).toHaveBeenNthCalledWith(
        1,
        'data',
        expect.any(Function)
      )

      const [, handleData] = connection1.on.mock.calls[0]
      handleData({
        peers: [connection2.peer, connection3.peer]
      })
      expect(connection1.removeListener).toHaveBeenNthCalledWith(
        1,
        'data',
        handleData
      )

      expect(connection2.once).toHaveBeenNthCalledWith(
        openForPeersIdx + 1,
        'open',
        expect.any(Function)
      )
      expect(connection2.once).toHaveBeenNthCalledWith(
        errorIdx + 1,
        'error',
        expect.any(Function)
      )

      const [, handleOpenConnection2] = connection2.once.mock.calls[
        openForPeersIdx
      ]
      handleOpenConnection2()
      expect(connection2.on).not.toHaveBeenCalled()
      const [, handleOpenConnection3] = connection2.once.mock.calls[
        openForPeersIdx
      ]
      handleOpenConnection3()
      expect(connection3.on).not.toHaveBeenCalled()

      await expect(promise).resolves.not.toBeDefined()
      expect(connection1.on).toHaveBeenNthCalledWith(
        openForPeersIdx + 2,
        'open',
        expect.any(Function)
      )
      expect(connection1.on).toHaveBeenNthCalledWith(
        errorIdx + 2,
        'error',
        expect.any(Function)
      )
      expect(connection1.on).toHaveBeenNthCalledWith(
        dataIdx + 2,
        'data',
        expect.any(Function)
      )
      expect(connection1.on).toHaveBeenNthCalledWith(
        closeIdx + 2,
        'close',
        expect.any(Function)
      )
      expect(connection1.on).toHaveBeenCalledTimes(closeIdx + 2)
    })

    it('handles connections errors', async () => {
      const connection = {
        peer: randomUUID(),
        once: jest.fn(),
        on: jest.fn(),
        removeListener: jest.fn()
      }

      peer.connect.mockReturnValueOnce(connection)
      const promise = communication.connectWith(peer.id)

      expect(connection.once).toHaveBeenNthCalledWith(
        openForPeersIdx + 1,
        'open',
        expect.any(Function)
      )
      expect(connection.once).toHaveBeenNthCalledWith(
        errorIdx + 1,
        'error',
        expect.any(Function)
      )

      const error = new Error('Kaboom!')
      const [, handleError] = connection.once.mock.calls[errorIdx]
      handleError(error)
      await expect(promise).rejects.toEqual(error)
      expect(connection.on).not.toHaveBeenCalled()
    })
  })

  it('can receive data', () => {
    const connection = { peer: randomUUID(), on: jest.fn() }
    handleConnection(connection)

    const [, handleData] = connection.on.mock.calls[dataIdx]
    const data = { foo: randomUUID() }
    handleData(data)

    expect(get(communication.lastMessageReceived)).toEqual({
      ...data,
      peer: connection.peer
    })
  })

  describe('send()', () => {
    it('broadcasts data to all peers', () => {
      const connection1 = {
        peer: randomUUID(),
        on: jest.fn(),
        open: true,
        send: jest.fn()
      }
      handleConnection(connection1)
      const connection2 = {
        peer: randomUUID(),
        on: jest.fn(),
        open: true,
        send: jest.fn()
      }
      handleConnection(connection2)
      expect(get(communication.connected)).toEqual([connection1, connection2])

      let data = { foo: randomUUID() }
      communication.send(data)

      expect(get(communication.lastMessageSent)).toEqual({
        ...data,
        peer: peer.id
      })
      expect(connection1.send).toHaveBeenNthCalledWith(1, data)
      expect(connection2.send).toHaveBeenNthCalledWith(1, data)

      data = { bar: randomUUID() }
      communication.send(data)

      expect(get(communication.lastMessageSent)).toEqual({
        ...data,
        peer: peer.id
      })
      expect(connection1.send).toHaveBeenNthCalledWith(2, data)
      expect(connection2.send).toHaveBeenNthCalledWith(2, data)
      expect(connection1.send).toHaveBeenCalledTimes(2)
      expect(connection2.send).toHaveBeenCalledTimes(2)
    })

    it('sends data to a single peers', () => {
      const connection1 = {
        peer: randomUUID(),
        on: jest.fn(),
        open: true,
        send: jest.fn()
      }
      handleConnection(connection1)
      const connection2 = {
        peer: randomUUID(),
        on: jest.fn(),
        open: true,
        send: jest.fn()
      }
      handleConnection(connection2)
      expect(get(communication.connected)).toEqual([connection1, connection2])

      const data = { foo: randomUUID() }
      communication.send(data, connection2)

      expect(get(communication.lastMessageSent)).toEqual({
        ...data,
        peer: peer.id
      })
      expect(connection1.send).not.toHaveBeenCalled()
      expect(connection2.send).toHaveBeenCalledWith(data)
      expect(connection2.send).toHaveBeenCalledTimes(1)
    })

    it('disconnect closed peers on send', () => {
      const connection1 = { peer: randomUUID(), on: jest.fn(), send: jest.fn() }
      handleConnection(connection1)
      const connection2 = {
        peer: randomUUID(),
        on: jest.fn(),
        open: true,
        send: jest.fn()
      }
      handleConnection(connection2)
      expect(get(communication.connected)).toEqual([connection1, connection2])

      const data = { foo: randomUUID() }
      communication.send(data)

      expect(get(communication.lastMessageSent)).toEqual({
        ...data,
        peer: peer.id
      })
      expect(connection1.send).not.toHaveBeenCalled()
      expect(connection2.send).toHaveBeenCalledWith(data)
      expect(connection2.send).toHaveBeenCalledTimes(1)
      expect(get(communication.connected)).toEqual([connection2])
    })
  })
})
