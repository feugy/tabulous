import { lastToast, toastError, toastInfo } from '@src/stores/toaster'
import { translate } from '@tests/test-utils.js'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

describe('Toaster store', () => {
  const messageReceived = vi.fn()
  let subscription

  beforeAll(() => {
    subscription = lastToast.subscribe(messageReceived)
  })

  beforeEach(vi.resetAllMocks)

  afterAll(() => subscription.unsubscribe())

  describe('toastInfo()', () => {
    it('resolves content key', () => {
      const contentKey = 'labels.home'
      toastInfo({ contentKey })
      expect(messageReceived).toHaveBeenCalledWith({
        icon: 'info_outline',
        content: translate(contentKey)
      })
      expect(messageReceived).toHaveBeenCalledTimes(1)
    })

    it('passes translate extra parameters', () => {
      const contentKey = 'labels.player-joined'
      const player = { username: 'John' }
      toastInfo({ contentKey, player })
      expect(messageReceived).toHaveBeenCalledWith({
        icon: 'info_outline',
        content: translate(contentKey, { player })
      })
      expect(messageReceived).toHaveBeenCalledTimes(1)
    })
  })

  describe('toastError()', () => {
    it('resolves content key', () => {
      const contentKey = 'labels.home'
      toastError({ contentKey })
      expect(messageReceived).toHaveBeenCalledWith({
        color: 'var(--accent-warm-lighter)',
        icon: 'error_outline',
        content: translate(contentKey)
      })
      expect(messageReceived).toHaveBeenCalledTimes(1)
    })

    it('passes translate extra parameters', () => {
      const contentKey = 'labels.player-joined'
      const player = { username: 'John' }
      toastError({ contentKey, player })
      expect(messageReceived).toHaveBeenCalledWith({
        color: 'var(--accent-warm-lighter)',
        icon: 'error_outline',
        content: translate(contentKey, { player })
      })
      expect(messageReceived).toHaveBeenCalledTimes(1)
    })
  })
})
