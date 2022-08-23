import cookie from 'cookie'
import { recoverSession } from './stores/players'

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const { url, request, locals } = event
  if (url.pathname === '/logout') {
    return logOutAndRedirect()
  }
  if (url.searchParams.has('token')) {
    return extractTokenAndRedirect(url)
  }

  const token = extractToken(request)
  if (token) {
    locals.bearer = `Bearer ${token}`
    locals.session = await recoverSession(fetch, locals.bearer)
  }

  // session may be (un)set by endpoints
  return setCookie(await resolve(event), locals.session?.token)
}

function extractToken(request) {
  return cookie.parse(request.headers.get('cookie') || '').token
}

function logOutAndRedirect() {
  return setCookie(
    new Response(null, {
      status: 308,
      headers: { location: '/home' }
    })
  )
}

function extractTokenAndRedirect(url) {
  const token = url.searchParams.get('token')
  const location = url.searchParams.get('redirect') ?? url.pathname
  url.searchParams.delete('token')
  url.searchParams.delete('redirect')
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
    sameSite: true
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
