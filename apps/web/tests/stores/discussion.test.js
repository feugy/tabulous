import * as peerChannels from '@src/stores/peer-channels'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@src/stores/peer-channels', () => {
  const { Subject } = require('rxjs')
  const lastMessageSent = new Subject()
  return {
    lastMessageReceived: new Subject(),
    lastMessageSent,
    send: data => lastMessageSent.next({ data })
  }
})

describe('Discussion store', () => {
  let discussion
  const playerId = '123456'
  const text1 = 'message 1'
  const text2 = 'message 2'
  const text3 = 'message 3'
  const text4 = 'message 4'
  const text5 = 'message 5'

  beforeAll(async () => {
    discussion = await import('@src/stores/discussion')
  })

  beforeEach(() => {
    discussion.clearThread()
  })

  it('enqueues received messages', () => {
    expect(discussion.serializeThread()).toEqual([])
    for (const text of [text1, text2, text3]) {
      peerChannels.lastMessageReceived.next({
        data: { type: 'message', text },
        playerId
      })
    }
    expect(discussion.serializeThread()).toEqual([
      { text: text1, playerId },
      { text: text2, playerId },
      { text: text3, playerId }
    ])
  })

  it('enqueues sent messages', () => {
    expect(discussion.serializeThread()).toEqual([])
    for (const message of [text1, text2, text3]) {
      discussion.sendToThread(message)
    }
    expect(discussion.serializeThread()).toEqual([
      { text: text1, time: expect.any(Number) },
      { text: text2, time: expect.any(Number) },
      { text: text3, time: expect.any(Number) }
    ])
  })

  it('enqueues sent and received messages', () => {
    expect(discussion.serializeThread()).toEqual([])
    peerChannels.lastMessageReceived.next({
      data: { type: 'message', text: text1 },
      playerId
    })
    discussion.sendToThread(text2)
    peerChannels.lastMessageReceived.next({
      data: { type: 'message', text: text3 },
      playerId
    })
    peerChannels.lastMessageReceived.next({
      data: { type: 'message', text: text4 },
      playerId
    })
    discussion.sendToThread(text5)
    expect(discussion.serializeThread()).toEqual([
      { text: text1, playerId },
      { text: text2, time: expect.any(Number) },
      { text: text3, playerId },
      { text: text4, playerId },
      { text: text5, time: expect.any(Number) }
    ])
  })

  it('loads messages into thread', () => {
    peerChannels.lastMessageReceived.next({
      data: { type: 'message', text: text1 },
      playerId
    })
    expect(discussion.serializeThread()).toEqual([{ text: text1, playerId }])
    const messages = [
      { text: text2, playerId, time: Date.now() - 10 },
      { text: text3, playerId, time: Date.now() - 5 },
      { text: text4, playerId, time: Date.now() }
    ]
    discussion.loadThread(messages)
    expect(discussion.serializeThread()).toEqual(messages)
  })
})
