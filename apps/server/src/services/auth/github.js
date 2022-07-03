import { fetch } from 'undici'
import { OAuth2Provider } from './oauth2.js'

const urls = {
  auth: 'https://github.com/login/oauth/authorize',
  token: 'https://github.com/login/oauth/access_token',
  user: 'https://api.github.com/user'
}

// https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps

class GithubAuthProvider extends OAuth2Provider {
  /**
   * Computes the URL to redirect the player browser for authentication.
   * @param {string} location? - the final location to redirect browser to.
   * @returns {URL} the redirection URL.
   */
  buildAuthUrl(location) {
    const url = new URL(urls.auth)
    url.searchParams.set('scope', 'user:email')
    url.searchParams.set('client_id', this.id)
    url.searchParams.set('state', this.storeFinalLocation(location))
    return url
  }

  /**
   * Fetches user details on Github from the authentication results.
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
    const token = await fetchToken(this.id, this.secret, code)
    return {
      location,
      user: mapToUserDetails(await fetchUser(token))
    }
  }
}

export const githubAuth = new GithubAuthProvider()

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
  return (await response.json()).access_token
}

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

function mapToUserDetails({ login: username, avatar_url: avatar, email }) {
  return { username, avatar, email }
}
