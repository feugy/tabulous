import { createDecoder } from 'fast-jwt'
import { fetch, FormData } from 'undici'
import { OAuth2Provider } from './oauth2.js'

const urls = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token'
}

const decodeJwt = createDecoder()

// https://developers.google.com/identity/protocols/oauth2/openid-connect?

class GoogleAuthProvider extends OAuth2Provider {
  /**
   * Computes the URL to redirect the player browser for authentication.
   * @param {string} location? - the final location to redirect browser to.
   * @returns {URL} the redirection URL.
   */
  buildAuthUrl(location) {
    const url = new URL(urls.auth)
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('client_id', this.id)
    url.searchParams.set('state', this.storeFinalLocation(location))
    url.searchParams.set('redirect_uri', this.redirect)
    url.searchParams.set('response_type', 'code')
    return url
  }

  /**
   * Fetches user details on Google from the authentication results.
   * @param {string} code - code provided during redirection.
   * @param {string} state - state embedded during redirection.
   * @returns {import('./oauth2.js').UserDetailsAndLocation} user details and the final location.
   * @throws {Error} when authentication results are invalid.
   * @throws {Error} when provided state is unknown.
   */
  async authenticateUser(code, state) {
    const location = this.locationByKey.get(state)
    if (!location) {
      throw new Error('forbidden')
    }
    return {
      location,
      user: mapToUserDetails(await fetchUserData(code, this))
    }
  }
}

export const googleAuth = new GoogleAuthProvider()

async function fetchUserData(code, { id, secret, redirect }) {
  const body = new FormData()
  body.append('code', code)
  body.append('client_id', id)
  body.append('client_secret', secret)
  body.append('grant_type', 'authorization_code')
  body.append('redirect_uri', redirect)
  const response = await fetch(urls.token, {
    method: 'POST',
    body
  })
  if (!response.ok) {
    throw new Error('forbidden')
  }
  return decodeJwt((await response.json()).id_token)
}

function mapToUserDetails({ given_name: username, picture: avatar, email }) {
  return { username, avatar, email }
}
