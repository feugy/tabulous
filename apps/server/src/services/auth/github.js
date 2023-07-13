// @ts-check
import { OAuth2Provider } from './oauth2.js'

/**
 * @typedef {object} GithubUser
 * @property {string} id
 * @property {string} login
 * @property {string} avatar_url
 * @property {string} email
 * @property {string=} name
 */

const urls = {
  auth: 'https://github.com/login/oauth/authorize',
  token: 'https://github.com/login/oauth/access_token',
  user: 'https://api.github.com/user'
}

// https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps

class GithubAuthProvider extends OAuth2Provider {
  /**
   * Computes the URL to redirect the player browser for authentication.
   * @override
   * @param {string} [location] - the final location to redirect browser to.
   */
  buildAuthUrl(location) {
    const url = new URL(urls.auth)
    url.searchParams.set('scope', 'user:email')
    url.searchParams.set('client_id', this.id)
    url.searchParams.set('state', this.storeFinalLocation(location))
    this.logger.trace({ res: url.toString() }, 'built authentication url')
    return url
  }

  /**
   * Fetches user details on Github from the authentication results.
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
    const token = await fetchToken(this.id, this.secret, code)
    const user = mapToUserDetails(await fetchUser(token))
    this.logger.trace({ ctx, res: user }, 'authenticated user')
    return { location, user }
  }
}

export const githubAuth = new GithubAuthProvider('github')

/**
 * @param {string} id
 * @param {string} secret
 * @param {string} code
 * @returns {Promise<string>}
 */
async function fetchToken(id, secret, code) {
  const response = await fetch(urls.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      client_id: id,
      client_secret: secret,
      code
    })
  })
  if (!response.ok) {
    throw new Error('forbidden')
  }
  return /** @type {{ access_token: string }} */ (await response.json())
    .access_token
}

/**
 * @param {string} token
 * @returns {Promise<GithubUser>}
 */
async function fetchUser(token) {
  const response = await fetch(urls.user, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  })
  if (!response.ok) {
    throw new Error('forbidden')
  }
  return response.json()
}

/**
 * @param {GithubUser} user
 * @returns {Partial<import('../players').Player>}>
 */
function mapToUserDetails({
  id: providerId,
  login: username,
  avatar_url: avatar,
  email,
  name
}) {
  return { username, avatar, email, providerId, fullName: name || username }
}
