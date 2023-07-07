import { redirect } from '@sveltejs/kit'

const termsUrl = '/accept-terms'

/** @type {import('./$types').LayoutServerLoad} */
export function load({ url, locals }) {
  const { bearer = null, session = null, timeZone } = locals
  if (session && !session.player?.termsAccepted && url.pathname !== termsUrl) {
    const location =
      url.pathname === '/'
        ? undefined
        : encodeURIComponent(url.href.replace(url.origin, ''))
    throw redirect(307, `${termsUrl}${location ? `?redirect=${location}` : ''}`)
  }
  return { bearer, session, timeZone }
}
