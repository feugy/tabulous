// @ts-check
import { createDecoder } from 'fast-jwt'

import { OAuth2Provider } from './oauth2.js'

/**
 * @typedef {object} GoogleUser
 * @property {string} sub
 * @property {string} given_name
 * @property {string} picture
 * @property {string} email
 * @property {string=} name
 */

const urls = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token'
}

const decodeJwt = createDecoder()

// https://developers.google.com/identity/protocols/oauth2/openid-connect?

class GoogleAuthProvider extends OAuth2Provider {
  /**
   * Computes the URL to redirect the player browser for authentication.
   * @override
   * @param {string} [location] - the final location to redirect browser to.
   */
  buildAuthUrl(location) {
    const url = new URL(urls.auth)
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('client_id', this.id)
    url.searchParams.set('state', this.storeFinalLocation(location))
    url.searchParams.set('redirect_uri', this.redirect)
    url.searchParams.set('response_type', 'code')
    this.logger.trace({ res: url.toString() }, 'built authentication url')
    return url
  }

  /**
   * Fetches user details on Google from the authentication results.
   * @override
   * @param {string} code - authorization code provided during redirection.
   * @param {string} state - state embedded during redirection.
   * @throws {Error} when authentication results are invalid.
   * @throws {Error} when provided state is unknown.
   */
  async authenticateUser(code, state) {
    const ctx = { code, state, location: null }
    this.logger.trace({ ctx }, 'authenticating user')
    const location = this.locationByKey.get(state)
    if (!location) {
      this.logger.trace(
        { ctx, res: 'no location found' },
        'failed to authenticate user'
      )
      throw new Error('forbidden')
    }
    ctx.location = location
    this.logger.trace({ ctx }, 'fetching user details')
    const user = mapToUserDetails(await fetchUserData(code, this))
    this.logger.trace({ ctx, res: user }, 'authenticated user')
    return { location, user }
  }
}

export const googleAuth = new GoogleAuthProvider('google')

/**
 * @param {string} code
 * @param {GoogleAuthProvider} provider
 * @returns {Promise<GoogleUser>}
 */
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
  return decodeJwt(
    /** @type {{ id_token: string }} */ (await response.json()).id_token
  )
}

/**
 * @param {GoogleUser} user
 * @returns {Partial<import('../players').Player>}>
 */
function mapToUserDetails({
  sub: providerId,
  given_name: username,
  picture: avatar,
  email,
  name
}) {
  return { username, avatar, email, providerId, fullName: name || username }
}
