import { createHmac } from 'crypto'

/**
 * @typedef {object} TurnCredentials used to connect to the turn server
 * @property {string} username - unix timestamp representing the expiry date.
 * @property {string} credentials - required to connect.
 */

/**
 * Generates valid credentials for using the turn server.
 * @param {string} secret - secret configured in coTurn server as `static-auth-secret`.
 * @returns {TurnCredentials} credentials for using the turn server.
 */
export function generateTurnCredentials(secret) {
  // credits to https://medium.com/@helderjbe/setting-up-a-turn-server-with-node-production-ready-8f4a4c36e64d
  const username = (Math.floor(Date.now() / 1000) + 12 * 3600).toString()
  return {
    username,
    credentials: hash(secret, username)
  }
}

function hash(secret, value) {
  return createHmac('sha1', secret).update(value).digest('base64')
}
