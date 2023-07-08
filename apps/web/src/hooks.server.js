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

function extractToken(request) {
  return cookie.parse(request.headers.get('cookie') || '').token
}

function logOutAndRedirect(lang) {
  return setCookie(
    new Response(null, {
      status: 307,
      headers: { location: lang ? `/${lang}/home` : '/home' }
    })
  )
}

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

function setCookie(response, token) {
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
