import TTLCache from '@isaacs/ttlcache'
import { randomUUID } from 'crypto'

/**
 * @typedef {object} UserDetailsAndLocation
 * @property {import('../players').UserDetails} user - user details from the provider
 * @property {string} location - final desired redirection url
 */

/**
 * Base class for OAuth2-based identity providers
 */
export class OAuth2Provider {
  constructor() {
    this.locationByKey = new TTLCache({ ttl: 60 * 60 * 1000 })
  }

  /**
   * Initializes the authentication provider
   * @param {object} options authentication options, including:
   * @param {string} options.id - OAuth client ID.
   * @param {string} options.secret - OAuth client secret.
   * @param {string} options.redirect - Allowed redirection url.
   */
  init({ id, secret, redirect }) {
    this.id = id
    this.secret = secret
    this.redirect = redirect
  }

  /**
   * Store final location for 10' and return a unique key that can be used as CSRF token.
   * Intended for subclasses.
   * @param {string} [location='/'] - the stored location
   * @returns {string} key to access this location
   */
  storeFinalLocation(location = '/') {
    const key = randomUUID()
    this.locationByKey.set(key, location)
    return key
  }

  /**
   * Computes the URL to redirect the player browser for authentication.
   * @param {string} location? - the final location to redirect browser to.
   * @returns {URL} the redirection URL.
   */
  buildAuthUrl() {
    throw new Error('not implemented')
  }

  /**
   * Fetches user details from the authentication results.
   * @param {string} code - authorization code provided during redirection.
   * @param {string} state - state embedded during redirection.
   * @returns {UserDetailsAndLocation} user details and the final location.
   */
  async authenticateUser() {
    throw new Error('not implemented')
  }
}
