import { notify } from '@src/stores/notifications'
import { translate } from '@tests/test-utils.js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Notification store notify()', () => {
  const requestPermission = vi.fn()
  const focus = vi.spyOn(window, 'focus')

  beforeAll(() => {
    window.Notification = vi.fn()
    Notification.requestPermission = requestPermission
  })

  beforeEach(vi.resetAllMocks)

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
      expect(Notification).not.toHaveBeenCalled()
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
      Notification.permission = 'default'
      requestPermission.mockImplementation(async () => {
        Notification.permission = 'granted'
      })
      const contentKey = 'labels.home'
      await notify({ contentKey })
      expect(requestPermission).toHaveBeenCalledOnce()
      expect(Notification).toHaveBeenCalledWith(translate(contentKey), {
        requireInteraction: true
      })
      expect(Notification).toHaveBeenCalledOnce()
      expect(focus).not.toHaveBeenCalled()
    })

    it('requests user permission and stops when denied', async () => {
      Notification.permission = 'default'
      requestPermission.mockImplementation(async () => {
        Notification.permission = 'denied'
      })
      await notify({ contentKey: 'labels.home' })
      expect(requestPermission).toHaveBeenCalledOnce()
      expect(Notification).not.toHaveBeenCalled()
      expect(focus).not.toHaveBeenCalled()
    })

    it('displays notification when granted already', async () => {
      Notification.permission = 'granted'
      const contentKey = 'labels.home'
      await notify({ contentKey })
      expect(Notification).toHaveBeenCalledWith(translate(contentKey), {
        requireInteraction: true
      })
      expect(Notification).toHaveBeenCalledOnce()
      expect(requestPermission).not.toHaveBeenCalled()
      expect(focus).not.toHaveBeenCalled()
    })

    it('focuses window when clicking on notification', async () => {
      Notification.permission = 'granted'
      await notify({ contentKey: 'labels.home' })
      expect(Notification).toHaveBeenCalledOnce()
      expect(requestPermission).not.toHaveBeenCalled()
      Notification.mock.instances[0].onclick()
      expect(focus).toHaveBeenCalledOnce()
    })

    it('does nothing when denied already', async () => {
      Notification.permission = 'denied'
      await notify({ contentKey: 'labels.home' })
      expect(Notification).not.toHaveBeenCalled()
      expect(requestPermission).not.toHaveBeenCalled()
      expect(focus).not.toHaveBeenCalled()
    })
  })
})
