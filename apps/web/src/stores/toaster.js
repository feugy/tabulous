// @ts-check
/**
 * @typedef {import('@src/types').Translate} Translate
 */

import { Subject } from 'rxjs'
import { _ } from 'svelte-intl'

/** @type {Subject<Toast>} */
const lastToast$ = new Subject()
/** @type {Translate} */
let translate
_.subscribe(value => (translate = value))

/**
 * @typedef {object} _CommonToastInfo
 * @property {string} [icon] - optional icon name used.
 * @property {string} [color] - optional background color used.
 *
 * @typedef {object} _ToastInfo
 * @property {?string} contentKey - i18n key used for content.
 * @property {Parameters<Translate>[1]} [args] - object argument passed to i18n formatMessage()
 *
 * @typedef {object} _TranslatedToastInfo
 * @property {?string} content - already translated content.
 *
 * @typedef {(Record<string, ?> & _CommonToastInfo & _ToastInfo) | (Record<string, ?> & _CommonToastInfo & _TranslatedToastInfo)} ToastInfo
 */

/**
 * @typedef {object} Toast
 * @property {string} content - toasted message
 * @property {string} [icon] - optional icon name used.
 * @property {string} [color] - optional background color used.
 * @property {number} [duration] - how long this toast is displayed in seconds (defaults to 4)?.
 */

/**
 * Emits with the last toast message desired.
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
