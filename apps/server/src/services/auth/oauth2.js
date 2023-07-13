// @ts-check
import { randomUUID } from 'node:crypto'

import TTLCache from '@isaacs/ttlcache'

import { makeLogger } from '../../utils/index.js'

/**
 * @typedef {object} UserDetailsAndLocation
 * @property {Partial<import('../players').Player>} user - user details from the provider
 * @property {string} location - final desired redirection url
 */

/**
 * @typedef {object} ProviderInit
 * @property {string} id - OAuth client ID.
 * @property {string} secret - OAuth client secret.
 * @property {string} redirect - Allowed redirection url.
 */

/**
 * Base class for OAuth2-based identity providers
 */
export class OAuth2Provider {
  /**
   * @param {string} name - name of this OAuth2 provider.
   */
  constructor(name) {
    this.name = name
    this.locationByKey = new TTLCache({ ttl: 60 * 60 * 1000 })
    this.id = ''
    this.redirect = ''
    this.secret = ''
    this.logger = makeLogger(`${name}-auth-provider`, { ctx: { oauth2: name } })
  }

  /**
   * Initializes the authentication provider
   * @param {ProviderInit} options authentication options, including:
   */
  init({ id, secret, redirect }) {
    this.id = id
    this.secret = secret
    this.redirect = redirect
    this.logger.debug({ ctx: { redirect } }, 'initialized provider')
  }

  /**
   * Store final location for 1h and return a unique key that can be used as CSRF token.
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
   * @param {string} [location] - the final location to redirect browser to.
   * @returns {URL} the redirection URL.
   */
  // eslint-disable-next-line no-unused-vars
  buildAuthUrl(location) {
    throw new Error('not implemented')
  }

  /**
   * Fetches user details from the authentication results.
   * @param {string} code - authorization code provided during redirection.
   * @param {string} state - state embedded during redirection.
   * @returns {Promise<UserDetailsAndLocation>} user details and the final location.
   */
  // eslint-disable-next-line no-unused-vars
  async authenticateUser(code, state) {
    throw new Error('not implemented')
  }
}
