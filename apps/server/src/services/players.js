import { randomUUID } from 'crypto'
import repositories from '../repositories/index.js'

/**
 * @typedef {object} Player a player
 * @property {string} id - unique id.
 * @property {string} username - player user name.
 * @property {boolean} playing - whether this player has currently joined an active game.
 * @property {boolean} [isAdmin] - whether this player has elevated priviledges or not.
 * @property {string[]} [catalog] - list of copyrighted games this player has accessed to.
 */

/**
 * @typedef {object} UserDetails details for a given user, as provided by authentication providers
 * @property {string} username - player user name.
 */

/**
 * Creates a new player account, saving user details as they are provided.
 * If the incomind data contains provider & providerId fields, it first search for an existing acccount.
 * In this situation, the existing data is updated with incomind data, except id, username and avatar,
 * which are kept as is.
 * In case no id is provided, a new one is created.
 * @param {UserDetails} userDetails - creation details.
 * @returns {Promise<Player>} the creates player.
 */
export async function addPlayer(userDetails) {
  if (userDetails.provider) {
    const existing = await repositories.players.getByProviderDetails(
      userDetails
    )
    if (existing) {
      userDetails = {
        ...existing,
        ...userDetails,
        avatar: existing.avatar,
        username: existing.username,
        id: existing.id
      }
    }
  }
  return repositories.players.save({
    id: randomUUID(),
    ...userDetails,
    playing: false
  })
}

/**
 * Returns a single or several player from their id.
 * @param {string|string[]} playerId - desired player id(s).
 * @returns {Promise<object|null|[object|null]>} matching player(s), or null(s).
 */
export async function getPlayerById(playerId) {
  return repositories.players.getById(playerId)
}

/**
 * Changes player's "is playing" flag.
 * Does nothing when no player is matching the given id.
 * @param {string} playerId - related player id.
 * @param {boolean} playing - new value for the flag.
 * @returns {Promise<Player|null>} the modified player.
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
 * @param {boolean} [excludeCurrent=true] - whether to exclude current player from results.
 * @returns {Promise<Player[]>} list of matching players.
 */
export async function searchPlayers(search, playerId, excludeCurrent = true) {
  if ((search ?? '').trim().length < 2) return []
  const { results } = await repositories.players.searchByUsername({
    search,
    size: 50
  })
  return excludeCurrent ? results.filter(({ id }) => id !== playerId) : results
}

/**
 * Records a player accepting terms of service.
 * @param {Player} player - the corresponding player.
 * @returns {Promise<Player>} the player, updates.
 */
export async function acceptTerms(player) {
  return repositories.players.save({ ...player, termsAccepted: true })
}
