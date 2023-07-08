/**
 * @type {string[]} supported language codes (default comes first).
 */
export const supportedLanguages = ['fr', 'en']

/** @type {import('@sveltejs/kit').ParamMatcher} */
export function match(param) {
  return param === '' || supportedLanguages.includes(param)
}
