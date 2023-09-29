// @ts-check
import { createHmac } from 'node:crypto'

/**
 * Generates valid credentials for using the turn server.
 * @param {string} secret - secret configured in coTurn server as `static-auth-secret`.
 * @returns {import('@tabulous/types').TurnCredentials} credentials for using the turn server.
 */
export function generateTurnCredentials(secret) {
  // credits to https://medium.com/@helderjbe/setting-up-a-turn-server-with-node-production-ready-8f4a4c36e64d
  const username = (Math.floor(Date.now() / 1000) + 12 * 3600).toString()
  return {
    username,
    credentials: hash(secret, username)
  }
}

function hash(/** @type {string} */ secret, /** @type {string} */ value) {
  return createHmac('sha1', secret).update(value).digest('base64')
}
