// @ts-check
import { createSigner } from 'fast-jwt'

import { loadConfiguration } from './configuration.js'

/**
 * Creates a signed JWT that can be used as authentication token.
 * @param {string} [userId] - id of the impersonated user. Default to the one from configuration.
 * @returns {string} the corresponding signed JWT.
 */
export function signToken(userId) {
  const { jwt, adminUserId } = loadConfiguration()
  return createSigner(jwt)({ id: userId ?? adminUserId })
}
