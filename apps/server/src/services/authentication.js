import repositories from '../repositories/index.js'

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
  const player = await repositories.players.getByUsername(username)
  if (!player) {
    return repositories.players.save({
      id: `${Math.floor(Math.random() * 9000 + 1000)}`,
      username,
      playing: false
    })
  }
  return player
}

/**
 * Returns a single or several player from their id.
 * @async
 * @param {string|string[]} playerId - desired player id(s).
 * @returns {object|null|[object|null]} matching player(s), or null(s).
 */
export async function getPlayerById(playerId) {
  return repositories.players.getById(playerId)
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
    return repositories.players.save({ id: playerId, playing })
  }
  return player
}
