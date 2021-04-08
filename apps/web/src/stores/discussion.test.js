import * as communication from './communication'

jest.mock('./communication', () => {
  const { Subject } = require('rxjs')
  const lastMessageSent = new Subject()
  return {
    lastMessageReceived: new Subject(),
    lastMessageSent,
    send: lastMessageSent.next.bind(lastMessageSent)
  }
})

describe('Discussion store', () => {
  let subscription
  let threadContent
  let discussion

  beforeAll(async () => {
    discussion = await import('./discussion')
    subscription = discussion.thread.subscribe(
      content => (threadContent = content)
    )
  })

  afterAll(() => subscription.unsubscribe())

  beforeEach(() => {
    discussion.clearThread()
  })

  it('enqueues received messages', () => {
    expect(threadContent).toEqual([])
    const message1 = 'message 1'
    const message2 = 'message 2'
    const message3 = 'message 3'

    for (const message of [message1, message2, message3]) {
      communication.lastMessageReceived.next({ message })
    }

    expect(threadContent).toEqual([
      { message: message1 },
      { message: message2 },
      { message: message3 }
    ])
  })

  it('enqueues sent messages', () => {
    expect(threadContent).toEqual([])
    const message1 = 'message 1'
    const message2 = 'message 2'
    const message3 = 'message 3'

    for (const message of [message1, message2, message3]) {
      discussion.sendToThread(message)
    }

    expect(threadContent).toEqual([
      { message: message1 },
      { message: message2 },
      { message: message3 }
    ])
  })

  it('enqueues sent and received messages', () => {
    expect(threadContent).toEqual([])
    const message1 = 'message 1'
    const message2 = 'message 2'
    const message3 = 'message 3'
    const message4 = 'message 4'
    const message5 = 'message 5'

    communication.lastMessageReceived.next({ message: message1 })
    discussion.sendToThread(message2)
    communication.lastMessageReceived.next({ message: message3 })
    communication.lastMessageReceived.next({ message: message4 })
    discussion.sendToThread(message5)

    expect(threadContent).toEqual([
      { message: message1 },
      { message: message2 },
      { message: message3 },
      { message: message4 },
      { message: message5 }
    ])
  })
})
