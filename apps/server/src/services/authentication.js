const players = new Map()

/**
 * Logs a given user into Tabulous.
 * Currently allows any input, assigning an id to the new ones, and returning already know id.
 * @async
 * @param {string} username - the player's username
 * @returns
 */
export async function logIn(username) {
  let player = [...players.values()].find(
    player => player.username === username
  )
  if (!player) {
    player = { id: `${Math.floor(Math.random() * 9000 + 1000)}`, username }
    players.set(player.id, player)
  }
  return player
}

/**
 * Returns a given player from its id.
 * @param {string} playerI - player id
 * @returns {object|null} the requested player, or null if no player matches it
 */
export async function getPlayerById(playerId) {
  return players.get(playerId) || null
}
