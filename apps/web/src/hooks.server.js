// @ts-check
import { pick } from 'accept-language-parser'
import cookie from 'cookie'

import { supportedLanguages } from './params/lang'
import { recoverSession } from './stores/players'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const {
    url,
    request,
    locals,
    params: { lang }
  } = event
  if (url.pathname === '/logout') {
    return logOutAndRedirect(lang)
  }
  if (!lang) {
    return redirectBasedOnLanguage(url, request.headers.get('accept-language'))
  }
  if (url.searchParams.has('token')) {
    return extractTokenAndRedirect(url)
  }

  const token = extractToken(request)
  if (token) {
    locals.bearer = `Bearer ${token}`
    locals.session = await recoverSession(fetch, locals.bearer)
  }

  locals.timeZone = request.headers.get('x-vercel-ip-timezone') || undefined

  // session may be (un)set by endpoints
  return setCookie(await resolve(event), locals.session?.token)
}

/**
 * Extract authentication token from cookie.
 * @param {Request} request - analyzed request.
 * @returns {?string|undefined} extracted token, if any.
 */
function extractToken(request) {
  return /** @type {?} */ (cookie.parse(request.headers.get('cookie') || ''))
    .token
}

/**
 * Logs out and redirect to (localized) home page.
 * @param {string} [lang] - locale used, if any.
 * @returns {Response} - 307 redirection.
 */
function logOutAndRedirect(lang) {
  return setCookie(
    new Response(null, {
      status: 307,
      headers: { location: lang ? `/${lang}/home` : '/home' }
    })
  )
}

/**
 * Analyze the accept-language request header and redirects to the
 * localized version of the specified url.
 * @param {URL} url - desired url.
 * @param {?string} languageHeader - requested language, if any.
 * @returns {Response} - 303 redirection.
 */
function redirectBasedOnLanguage(url, languageHeader) {
  const lang =
    pick(supportedLanguages, languageHeader, {
      loose: true
    }) || supportedLanguages[0]
  return new Response(null, {
    status: 303,
    headers: {
      location: `/${lang}${url.href.replace(url.origin, '')}`
    }
  })
}

/**
 * Extracts token and redirect query parameters (both optional)
 * to set authentication cookie and redirect to the specified url.
 * @param {URL} url - desired url.
 * @returns {Response} - 303 redirection.
 */
function extractTokenAndRedirect(url) {
  const token = url.searchParams.get('token')
  const redirect = url.searchParams.get('redirect')
  url.searchParams.delete('token')
  url.searchParams.delete('redirect')
  const location = redirect ?? url.href.replace(url.origin, '')
  return setCookie(
    new Response(null, {
      status: 303,
      headers: { location }
    }),
    token
  )
}

/**
 * Sets or unsets the authentication cookie on a given response.
 * @param {Response} response - enriched response.
 * @param {?string} [token] - authentication token.
 * @returns {Response} - 303 redirection.
 */
function setCookie(response, token) {
  /** @type {?} */
  const cookieOptions = {
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'None'
  }
  if (!token) {
    cookieOptions.expires = new Date(1)
  }
  response.headers.set(
    'set-cookie',
    cookie.serialize('token', token ?? '', cookieOptions)
  )
  return response
}
