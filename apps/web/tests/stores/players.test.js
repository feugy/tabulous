import { randomUUID } from 'crypto'
import { Subject } from 'rxjs'
import * as communication from '@src/stores/communication'
import * as engine from '@src/stores/engine'

jest.mock('@src/stores/communication')
jest.mock('@src/stores/engine')

describe('Players store', () => {
  const action = new Subject()
  engine.action.subscribe = action.subscribe.bind(action)

  const pointer = new Subject()
  engine.pointer.subscribe = pointer.subscribe.bind(pointer)

  const lastMessageReceived = new Subject()
  communication.lastMessageReceived.subscribe = lastMessageReceived.subscribe.bind(
    lastMessageReceived
  )

  const lastConnected = new Subject()
  communication.lastConnected.subscribe = lastConnected.subscribe.bind(
    lastConnected
  )

  beforeAll(() => import('@src/stores/players'))

  beforeEach(jest.clearAllMocks)

  it('sends local actions to other players', async () => {
    const message = { foo: randomUUID() }
    action.next(message)

    expect(communication.send).toHaveBeenCalledWith(message)
    expect(communication.send).toHaveBeenCalledTimes(1)
    expect(engine.applyAction).not.toHaveBeenCalled()
  })

  it('sends pointer moves to other players', async () => {
    const message = { foo: randomUUID() }
    pointer.next(message)

    expect(communication.send).toHaveBeenCalledWith(message)
    expect(communication.send).toHaveBeenCalledTimes(1)
    expect(engine.movePeerPointer).not.toHaveBeenCalled()
  })

  it('moved player pointer when receiving message', async () => {
    const message = { foo: randomUUID() }

    lastMessageReceived.next({ whatever: message })
    expect(engine.movePeerPointer).not.toHaveBeenCalled()
    expect(communication.send).not.toHaveBeenCalled()

    lastMessageReceived.next({ pointer: message })

    expect(engine.movePeerPointer).toHaveBeenCalledWith({ pointer: message })
    expect(engine.movePeerPointer).toHaveBeenCalledTimes(1)
    expect(communication.send).not.toHaveBeenCalled()
  })

  it('apply player action when receiving message', async () => {
    const message = { meshId: randomUUID() }

    lastMessageReceived.next({ whatever: message })
    expect(engine.applyAction).not.toHaveBeenCalled()
    expect(communication.send).not.toHaveBeenCalled()

    lastMessageReceived.next(message)

    expect(engine.applyAction).toHaveBeenCalledWith(message)
    expect(engine.applyAction).toHaveBeenCalledTimes(1)
    expect(communication.send).not.toHaveBeenCalled()
  })

  it('loads scene when receiving message', async () => {
    const message = { foo: randomUUID() }

    lastMessageReceived.next({ whatever: message })
    expect(engine.loadScene).not.toHaveBeenCalled()
    expect(communication.send).not.toHaveBeenCalled()

    lastMessageReceived.next({ scene: message })

    expect(engine.loadScene).toHaveBeenCalledWith(message)
    expect(engine.loadScene).toHaveBeenCalledTimes(1)
    expect(communication.send).not.toHaveBeenCalled()
  })

  it('sends scene when a player connects', async () => {
    const scene = { foo: randomUUID() }
    const connection = { id: randomUUID() }
    engine.serializeScene.mockReturnValueOnce(scene)

    lastConnected.next(connection)
    expect(engine.serializeScene).toHaveBeenCalledTimes(1)
    expect(engine.serializeScene).toHaveBeenCalledTimes(1)
    expect(communication.send).toHaveBeenCalledWith({ scene }, connection)
    expect(communication.send).toHaveBeenCalledTimes(1)
  })
})
