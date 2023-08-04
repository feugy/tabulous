// @ts-check
/**
 * @typedef {import('@src/common').Locale} Locale
 */

/**
 * @type {Locale[]} supported language codes (default comes first).
 */
export const supportedLanguages = ['fr', 'en']

/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match(param) {
  return (
    param === '' || supportedLanguages.includes(/** @type {Locale} */ (param))
  )
}
