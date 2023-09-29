// @ts-check
/**
 * @type {import('@src/common').Locale[]} supported language codes (default comes first).
 */
export const supportedLanguages = ['fr', 'en']

/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match(param) {
  return (
    param === '' ||
    supportedLanguages.includes(
      /** @type {import('@src/common').Locale} */ (param)
    )
  )
}
