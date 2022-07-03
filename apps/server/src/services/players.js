import { randomUUID } from 'crypto'
import repositories from '../repositories/index.js'

/**
 * @typedef {object} Player a player
 * @property {string} id - unique id.
 * @property {string} username - player user name.
 * @property {boolean} playing - whether this player has currently joined an active game.
 */

/**
 * @typedef {object} UserDetails details for a given user, as provided by authentication providers
 * @property {string} username - player user name.
 */

/**
 * Connects a given user into Tabulous, from any authentication provider.
 * New players will be created on the fly.
 * @async
 * @param {UserDetails} userDetails - details provided by authentication provider.
 * @returns {Player} the authenticated player.
 */
export async function connect(userDetails) {
  const player = await repositories.players.getByUsername(userDetails?.username)
  if (!player) {
    return repositories.players.save({
      ...userDetails,
      id: randomUUID(),
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
