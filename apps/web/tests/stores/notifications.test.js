// @ts-check
import { notify } from '@src/stores/notifications'
import { translate } from '@tests/test-utils.js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Notification store notify()', () => {
  const requestPermission = vi.fn()
  const focus = vi.spyOn(window, 'focus')

  /** @type {typeof Notification & { permission: string } & import('vitest').Mock<?, ?>} */
  let NotificationMock

  beforeAll(() => {
    // @ts-expect-error not mocking the whole class
    window.Notification = vi.fn()
    Notification.requestPermission = requestPermission
    NotificationMock =
      /** @type {typeof Notification & { permission: string } & import('vitest').Mock<?, ?>} */ (
        Notification
      )
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('given visible window', () => {
    beforeEach(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible'
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    it('does nothing', async () => {
      await notify({ contentKey: 'labels.home' })
      expect(NotificationMock).not.toHaveBeenCalled()
      expect(requestPermission).not.toHaveBeenCalled()
    })
  })

  describe('given hidden window', () => {
    beforeEach(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden'
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    it('requests user permission and displays notification when granted', async () => {
      NotificationMock.permission = 'default'
      requestPermission.mockImplementation(async () => {
        NotificationMock.permission = 'granted'
      })
      const contentKey = 'labels.home'
      await notify({ contentKey })
      expect(requestPermission).toHaveBeenCalledOnce()
      expect(NotificationMock).toHaveBeenCalledWith(translate(contentKey), {
        requireInteraction: true
      })
      expect(NotificationMock).toHaveBeenCalledOnce()
      expect(focus).not.toHaveBeenCalled()
    })

    it('requests user permission and stops when denied', async () => {
      NotificationMock.permission = 'default'
      requestPermission.mockImplementation(async () => {
        NotificationMock.permission = 'denied'
      })
      await notify({ contentKey: 'labels.home' })
      expect(requestPermission).toHaveBeenCalledOnce()
      expect(NotificationMock).not.toHaveBeenCalled()
      expect(focus).not.toHaveBeenCalled()
    })

    it('displays notification when granted already', async () => {
      NotificationMock.permission = 'granted'
      const contentKey = 'labels.home'
      await notify({ contentKey })
      expect(NotificationMock).toHaveBeenCalledWith(translate(contentKey), {
        requireInteraction: true
      })
      expect(NotificationMock).toHaveBeenCalledOnce()
      expect(requestPermission).not.toHaveBeenCalled()
      expect(focus).not.toHaveBeenCalled()
    })

    it('focuses window when clicking on notification', async () => {
      NotificationMock.permission = 'granted'
      await notify({ contentKey: 'labels.home' })
      expect(NotificationMock).toHaveBeenCalledOnce()
      expect(requestPermission).not.toHaveBeenCalled()
      NotificationMock.mock.instances[0].onclick()
      expect(focus).toHaveBeenCalledOnce()
    })

    it('does nothing when denied already', async () => {
      NotificationMock.permission = 'denied'
      await notify({ contentKey: 'labels.home' })
      expect(NotificationMock).not.toHaveBeenCalled()
      expect(requestPermission).not.toHaveBeenCalled()
      expect(focus).not.toHaveBeenCalled()
    })
  })
})
