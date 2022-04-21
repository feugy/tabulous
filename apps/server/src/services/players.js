import { createHash } from 'crypto'
import repositories from '../repositories/index.js'

/**
 * @typedef {object} Player a player
 * @property {string} id - unique id.
 * @property {string} username - player user name.
 * @property {boolean} playing - whether this player has currently joined an active game.
 */

const masterPassword = hash('ehfada')

/**
 * Logs a given user into Tabulous.
 * The password HAS TO match the expected value.
 * Unknown players will be created on the flight.
 * @async
 * @param {string} username - the player's username.
 * @returns {Player|null} the authenticated player, or null if the passwords don't match.
 */
export async function logIn(username, password) {
  if (masterPassword !== hash(password)) {
    return null
  }
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

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
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

/**
 * Searches for player which usernames contains searched text, up to 50 results.
 * Excludes current player from results, and returns nothing unless search text is at least 2 characters
 * @param {string} search - searched text.
 * @param {string} playerId - the current player id.
 * @returns {Player[]} list of matching players.
 */
export async function searchPlayers(search, playerId) {
  if ((search ?? '').trim().length < 2) return []
  const { results } = await repositories.players.searchByUsername({
    search,
    size: 50
  })
  return results.filter(({ id }) => id !== playerId)
}
