/**
 * Turns a sentence in uppercase and only keeps its initials.
 * @param {string} value - abbreviated value.
 * @returns {string} value's initials.
 */
export function abbreviate(value) {
  const words = (value || '').toUpperCase().split(/\s|-|_/)
  return words
    .map(([letter]) => letter)
    .slice(0, 2)
    .join('')
}

/**
 * Translate errors from server into human-readable localized equivalent
 * @param {(key: string, options: object) => string} formatMessage - svelte-intl's format message function.
 * @param {Error} error - error to translate.
 * @return {string|null} the translate error message, if any
 */
export function translateError(svelteIntl, error) {
  const message = error?.message || error
  if (!message) {
    return null
  }
  if (/^Access to game/.test(message)) {
    return svelteIntl('errors.restricted-game')
  } else if (/^Username already used/.test(message)) {
    return svelteIntl('errors.username-used')
  }
  const match = message.match(/^You own (\d+) games/)
  if (match) {
    return svelteIntl('errors.too-many-games', { count: match[1] })
  }
  return message
}
