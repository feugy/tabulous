// @ts-check
import { redirect } from '@sveltejs/kit'

const termsUrl = '/accept-terms'

/** @type {import('./$types').LayoutServerLoad} */
export function load({ url, locals, params: { lang }, depends }) {
  const { bearer = null, session = null, timeZone } = locals
  const localizedTerms = `${lang ? `/${lang}` : ''}${termsUrl}`
  if (
    session &&
    !session.player?.termsAccepted &&
    url.pathname !== localizedTerms
  ) {
    const location = encodeURIComponent(url.href.replace(url.origin, ''))
    throw redirect(
      307,
      `${localizedTerms}${location ? `?redirect=${location}` : ''}`
    )
  }
  depends('data:session')
  return {
    bearer,
    session,
    timeZone,
    lang: /** @type {import('@src/common').Locale} */ (lang)
  }
}
