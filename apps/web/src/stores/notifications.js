// @ts-check
import { _ } from 'svelte-intl'

import { browser } from '$app/environment'

let isActive = true
/** @type {import('@src/types').Translate} */
let translate
_.subscribe(value => (translate = value))

if (browser) {
  document.addEventListener(
    'visibilitychange',
    () => (isActive = document.visibilityState === 'visible')
  )
}

/**
 * @typedef {object} Notification
 * @property {string} contentKey - i18n key used for content.
 * @property {Parameters<import('@src/types').Translate>[1]} [args] - object argument passed to i18n formatMessage()
 */

/**
 * Notifies users, through the browser built-in mechanism, if they allow it.
 * Only when the tab is not active.
 * @param {Notification} notification - notification content
 */
export async function notify({ contentKey, ...args }) {
  if (!isActive) {
    if (await requestPermission()) {
      const notification = new Notification(translate(contentKey, args), {
        requireInteraction: true
      })
      notification.onclick = () => window.focus()
    }
  }
}

async function requestPermission() {
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
  return Notification.permission === 'granted'
}
