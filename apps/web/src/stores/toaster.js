import { Subject } from 'rxjs'
import { _ } from 'svelte-intl'

const lastToast$ = new Subject()
let translate
_.subscribe(value => (translate = value))

/**
 * @typedef {object} ToastInfo
 * @property {string} contentKey - i18n key used for content.
 * @property {string} content - already translated content.
 * @property {icon} [icon] - optional icon name used.
 * @property {color} [color] - optional background color used.
 * @property {...any} [args] - other argument passed to i18n formatMessage().
 */

/**
 * @typedef {object} Toast
 * @property {string} content - toasted message
 * @property {icon} [icon] - optional icon name used.
 * @property {color} [color] - optional background color used.
 */

/**
 * Emits with the last toast message desired.
 * @type {import('rxjs').Observable<Toast>}
 */
export const lastToast = lastToast$.asObservable()

/**
 * Toast an informative message to the player.
 * @param {ToastInfo} info - toasted message.
 */
export function toastInfo({ contentKey, content, icon, color, ...args }) {
  lastToast$.next({
    icon: icon ?? 'info_outline',
    color,
    content: content ?? translate(contentKey, args)
  })
}

/**
 * Toast an error message to the player.
 * @param {ToastInfo} error - toasted message.
 */
export function toastError({ contentKey, content, icon, color, ...args }) {
  lastToast$.next({
    icon: icon ?? 'error_outline',
    color: color ?? 'var(--accent-warm-lighter)',
    content: content ?? translate(contentKey, args)
  })
}
