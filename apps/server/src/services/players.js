import { createHash } from 'node:crypto'

import { Subject } from 'rxjs'
import { fetch } from 'undici'

import repositories from '../repositories/index.js'

const {
  FriendshipAccepted,
  FriendshipEnded,
  FriendshipProposed,
  FriendshipRequested
} = repositories

/**
 * @typedef {object} Player a player.
 * @property {string} id - unique id.
 * @property {string} username - player user name.
 * @property {number} currentGameId - game this player is currently playing.
 * @property {string} [avatar] - avatar used for display.
 * @property {string} [provider] - player's authentication provider, when relevant.
 * @property {string} [providerId] - authentication provider own id, when relevant.
 * @property {string} [email] - email from authentication provider, when relevant.
 * @property {boolean} [termsAccepted] - whether this player has accepted terms of service, or not.
 * @property {boolean} [isAdmin] - whether this player has elevated priviledges or not.
 * @property {string[]} [catalog] - list of copyrighted games this player has accessed to.
 */

/**
 * @typedef {object} Friendship a relationship between two players.
 * @property {string} playerId - id of the target player (origin player is implicit).
 * @property {boolean} isRequest? - when true, indicate a friendship request from the target player.
 */

export const friendshipUpdates = new Subject()

/**
 * Creates or updates a player account, saving user details as they are provided.
 * If the incoming data contains provider & providerId fields, it keeps previous id, avatar and username.
 * In case no id is provided, a new one is created.
 * @param {Partial<Player>} userDetails - creation details.
 * @returns {Promise<Player>} the creates player.
 */
export async function upsertPlayer(userDetails) {
  if (userDetails.provider && userDetails.providerId) {
    // data comes from an external provider
    const existing = await repositories.players.getByProviderDetails(
      userDetails
    )
    if (!existing) {
      // first connection
      const { username } = userDetails
      if (await isUsernameUsed(username)) {
        userDetails.username = `${username}-${Math.floor(Math.random() * 1000)}`
      }
      if (!userDetails.avatar) {
        userDetails.avatar = await findGravatar(userDetails)
      }
    } else {
      // subsequent connections
      delete userDetails.avatar
      delete userDetails.username
      userDetails.id = existing.id
    }
  } else {
    // data comes from the user
    delete userDetails.provider
    delete userDetails.providerId
    if (userDetails.avatar === 'gravatar') {
      const existing = await repositories.players.getById(userDetails.id)
      userDetails.avatar = await findGravatar({
        ...(existing || {}),
        ...userDetails
      })
    }
    delete userDetails.email
  }
  userDetails.currentGameId = null
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
 * Changes player's current game Id.
 * Does nothing when no player is matching the given id.
 * @param {string} playerId - related player id.
 * @param {string|null} currentGameId - id of the current game, or null.
 * @returns {Promise<Player|null>} the modified player.
 */
export async function setCurrentGameId(playerId, currentGameId) {
  const player = await getPlayerById(playerId)
  if (player) {
    return repositories.players.save({ id: playerId, currentGameId })
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

async function findGravatar(userDetails) {
  if (!userDetails.email) {
    return undefined
  }
  // https://fr.gravatar.com/site/implement/hash/
  const hash = createHash('md5')
    .update(userDetails.email.trim().toLowerCase())
    .digest('hex')
  // https://fr.gravatar.com/site/implement/images/
  const avatar = `https://www.gravatar.com/avatar/${hash}?s=96&r=g&d=404`
  const response = await fetch(avatar)
  return response.status === 200 ? avatar : undefined
}

/**
 * Returns the list of friends of a given player, including friendship requests, and blocked players.
 * @param {string} playerId - player id for who the list is returned.
 * @returns {Promise<Friendship[]>} list (possibly empty) of friendship relationships for the specified player.
 */
export async function listFriends(playerId) {
  const list = []
  for (const { id, state } of await repositories.players.listFriendships(
    playerId
  )) {
    if (state === FriendshipAccepted) {
      list.push({ playerId: id })
    } else if (state === FriendshipRequested) {
      list.push({ playerId: id, isRequest: true })
    } else if (state === FriendshipProposed) {
      list.push({ playerId: id, isProposal: true })
    }
  }
  return list
}

/**
 * Proposes a friendship request from one player to another one.
 * Publishes an update.
 * @param {Player} sender - sender player.
 * @param {string} playerId - id of the destination player.
 * @returns {Promise<boolean>} true if the request was proposed.
 */
export async function requestFriendship(sender, playerId) {
  if (!(await repositories.players.makeFriends(sender.id, playerId))) {
    return false
  }
  friendshipUpdates.next({ from: sender.id, to: playerId, requested: true })
  friendshipUpdates.next({ from: playerId, to: sender.id, proposed: true })
  return true
}

/**
 * Accepts a friendship request from another player.
 * Publishes an update.
 * @param {Player} sender - accepting player.
 * @param {string} playerId - id of the requesting player.
 * @returns {Promise<boolean>} true if the request was accepted.
 */
export async function acceptFriendship(sender, playerId) {
  if (
    !(await repositories.players.listFriendships(sender.id)).some(
      ({ id, state }) => id === playerId && state === FriendshipRequested
    )
  ) {
    return false
  }
  if (
    !(await repositories.players.makeFriends(
      sender.id,
      playerId,
      FriendshipAccepted
    ))
  ) {
    return false
  }
  friendshipUpdates.next({ from: sender.id, to: playerId, accepted: true })
  friendshipUpdates.next({ from: playerId, to: sender.id, accepted: true })
  return true
}

/**
 * Declines a friendship request or ends existing friendship.
 * @param {Player} sender - declining player.
 * @param {string} playerId - id of the declined player.
 * @returns {Promise<void>}
 */
export async function endFriendship(sender, playerId) {
  if (
    !(await repositories.players.makeFriends(
      sender.id,
      playerId,
      FriendshipEnded
    ))
  ) {
    return false
  }
  friendshipUpdates.next({ from: sender.id, to: playerId, declined: true })
  friendshipUpdates.next({ from: playerId, to: sender.id, declined: true })
  return true
}
