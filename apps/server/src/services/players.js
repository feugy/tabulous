import repositories from '../repositories/index.js'

/**
 * @typedef {object} Player a player
 * @property {string} id - unique id.
 * @property {string} username - player user name.
 * @property {boolean} playing - whether this player has currently joined an active game.
 * @property {string} [avatar] - avatar used for display.
 * @property {string} [provider] - player's authentication provider, when relevant.
 * @property {string} [providerId] - authentication provider own id, when relevant.
 * @property {string} [email] - email from authentication provider, when relevant.
 * @property {boolean} [termsAccepted] - whether this player has accepted terms of service, or not.
 * @property {boolean} [isAdmin] - whether this player has elevated priviledges or not.
 * @property {string[]} [catalog] - list of copyrighted games this player has accessed to.
 */

/**
 * Creates or updates a player account, saving user details as they are provided.
 * If the incomind data contains provider & providerId fields, it keeps previous id, avatar and username.
 * In case no id is provided, a new one is created.
 * @param {Partial<Player>} userDetails - creation details.
 * @returns {Promise<Player>} the creates player.
 */
export async function upsertPlayer(userDetails) {
  if (userDetails.provider && userDetails.providerId) {
    const existing = await repositories.players.getByProviderDetails(
      userDetails
    )
    if (existing) {
      delete userDetails.avatar
      delete userDetails.username
      userDetails.id = existing.id
    } else {
      const { username, provider } = userDetails
      if (await isUsernameUsed(username)) {
        userDetails.username = `${username} @${provider}`
      }
    }
  } else {
    delete userDetails.provider
    delete userDetails.providerId
    delete userDetails.email
  }
  return repositories.players.save(userDetails)
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
 * Indicates whether a given username is already used.
 * This is case insensitive, accent insensitive, and does not considere non-letters (emojis).
 * It can include a player id from the results.
 * @param {string} username - tested username.
 * @param {string} excludedId - id of excluded player.
 * @returns {Promise<boolean>} whether this username is already in use, or not.
 */
export async function isUsernameUsed(username, excludedId) {
  const { results } = await repositories.players.searchByUsername({
    search: username,
    exact: true
  })
  return results.filter(({ id }) => id !== excludedId).length > 0
}

/**
 * Records a player accepting terms of service.
 * @param {Player} player - the corresponding player.
 * @returns {Promise<Player>} the player, updates.
 */
export async function acceptTerms(player) {
  return repositories.players.save({ ...player, termsAccepted: true })
}
