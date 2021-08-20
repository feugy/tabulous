const players = new Map()

/**
 * @typedef {object} Player a player
 * @property {string} id - unique id.
 * @property {string} username - player user name.
 * @property {boolean} playing - whether this player has currently joined an active game.
 */

/**
 * Logs a given user into Tabulous.
 * Currently allows any input, assigning an id to the new ones, and returning already know id.
 * @async
 * @param {string} username - the player's username.
 * @returns {Player} the authenticated player.
 */
export async function logIn(username) {
  let player = [...players.values()].find(
    player => player.username === username
  )
  if (!player) {
    player = {
      id: `${Math.floor(Math.random() * 9000 + 1000)}`,
      username,
      playing: false
    }
    players.set(player.id, player)
  }
  return player
}

/**
 * Returns a given player from its id.
 * @param {string} playerId - player id
 * @returns {Player|null} the requested player, or null if no player matches it.
 */
export async function getPlayerById(playerId) {
  return players.get(playerId) ?? null
}

/**
 * Returns several players from their id, keeping results ordered as ids.
 * @param {string[]} playerIds - array of player ids.
 * @returns {[Player|null]} the requested players, or null if no player matches it.
 */
export async function getPlayersById(playerIds = []) {
  const result = []
  for (const id of playerIds) {
    result.push(players.get(id) ?? null)
  }
  return result
}

/**
 * Changes player's "is playing" flag.
 * Does nothing when no player is matching the given id.
 * @param {string} playerId - related player id.
 * @param {boolean} playing - new value for the flag.
 * @returns {Player|null} the modified player.
 */
export async function setPlaying(playerId, playing) {
  const player = await getPlayerById(playerId)
  if (player) {
    player.playing = playing
  }
  return player
}
