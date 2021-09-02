import services from '../services/index.js'

/**
 * Finds the authenticated player based on Bearer data.
 * @async
 * @param {string} bearer - Bearer data received from incoming request.
 * @returns {import('../services/authentication').Player|null} the corresponding player, if any.
 */
export async function getAuthenticatedPlayer(bearer) {
  let player = null
  if (bearer) {
    const id = bearer.replace('Bearer ', '')
    player = await services.getPlayerById(id)
  }
  return player
}
