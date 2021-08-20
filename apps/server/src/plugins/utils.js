import { getPlayerById } from '../services/index.js'

/**
 * Finds the authenticated player based on Bearer data.
 * @param {string} bearer - Bearer data received from incoming request.
 * @returns {Player|null} the corresponding player, if any.
 */
export async function getAuthenticatedPlayer(bearer) {
  let player = null
  if (bearer) {
    const id = bearer.replace('Bearer ', '')
    player = await getPlayerById(id)
  }
  return player
}
