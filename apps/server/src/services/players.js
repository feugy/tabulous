// @ts-check
import { createHash } from 'node:crypto'

import { Subject } from 'rxjs'

import * as repositories from '../repositories/index.js'
import { makeLogger } from '../utils/index.js'

const {
  FriendshipAccepted,
  FriendshipEnded,
  FriendshipProposed,
  FriendshipRequested
} = repositories

const logger = makeLogger('players-service')

/** @type {Subject<import('@tabulous/types').FriendshipUpdate>} */
export const friendshipUpdates = new Subject()

/**
 * Creates or updates a player account, saving user details as they are provided.
 * If the incoming data contains provider & providerId fields, it keeps previous id, avatar and username.
 * In case no id is provided, a new one is created.
 * @param {Partial<import('@tabulous/types').Player>} userDetails - creation details.
 * @returns the creates player.
 */
export async function upsertPlayer(userDetails) {
  const ctx = { ...userDetails, external: false }
  logger.trace({ ctx }, 'upserting player')
  if (userDetails.provider && userDetails.providerId && userDetails.username) {
    ctx.external = true
    // data comes from an external provider
    const existing =
      await repositories.players.getByProviderDetails(userDetails)
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
    if (userDetails.avatar === 'gravatar' && userDetails.id) {
      const existing = await repositories.players.getById(userDetails.id)
      userDetails.avatar = await findGravatar({
        ...(existing || {}),
        ...userDetails
      })
    }
    delete userDetails.email
  }
  userDetails.currentGameId = null
  const saved = await repositories.players.save(
    /** @type {Pick<import('@tabulous/types').Player, 'username' | 'id' | 'currentGameId'>} */ (
      userDetails
    )
  )
  logger.debug({ ctx, res: { id: saved.id } }, 'upserted player')
  return saved
}

/**
 * @overload
 * Returns a several players from their ids.
 * @param {(string|undefined)[]} playerId - desired player ids.
 * @returns {Promise<(?import('@tabulous/types').Player)[]>} matching players, or nulls.
 */
/**
 * @overload
 * Returns a single player from its id.
 * @param {string} playerId - desired player id.
 * @returns {Promise<?import('@tabulous/types').Player>} matching player, or null.
 */
export async function getPlayerById(
  /** @type {string|(string|undefined)[]} */ playerId
) {
  // @ts-expect-error: overload + template does not play well together
  return repositories.players.getById(playerId)
}

/**
 * Changes player's current game Id.
 * Does nothing when no player is matching the given id.
 * @param {string} playerId - related player id.
 * @param {?string} currentGameId - id of the current game, or null.
 * @returns the modified player.
 */
export async function setCurrentGameId(playerId, currentGameId) {
  const player = await getPlayerById(playerId)
  if (player) {
    logger.trace(
      { ctx: { playerId, currentGameId } },
      'setting player current game'
    )
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
 * @returns list of matching players.
 */
export async function searchPlayers(search, playerId, excludeCurrent = true) {
  if ((search ?? '').trim().length < 2) return []
  const ctx = { search, playerId, excludeCurrent }
  logger.trace({ ctx }, 'finding players')
  let { results } = await repositories.players.searchByUsername({
    search,
    size: 10
  })
  results = excludeCurrent
    ? results.filter(({ id }) => id !== playerId)
    : results
  logger.debug(
    {
      ctx,
      res: results.map(({ id, username, email }) => ({ id, username, email }))
    },
    'found players'
  )
  return results
}

/**
 * Indicates whether a given username is already used.
 * This is case insensitive, accent insensitive, and does not considere non-letters (emojis).
 * It can include a player id from the results.
 * @param {string} username - tested username.
 * @param {string} [excludedId] - id of excluded player.
 * @returns whether this username is already in use, or not.
 */
export async function isUsernameUsed(username, excludedId) {
  const ctx = { username, excludedId }
  logger.trace({ ctx }, 'checking username availability')
  const { results } = await repositories.players.searchByUsername({
    search: username,
    exact: true
  })
  const isAvailable = results.filter(({ id }) => id !== excludedId).length > 0
  logger.debug({ ctx, res: isAvailable }, 'checked username availability')
  return isAvailable
}

/**
 * Records a player accepting terms of service.
 * @param {import('@tabulous/types').Player} player - the corresponding player.
 * @returns the player, updates.
 */
export async function acceptTerms(player) {
  logger.trace(
    {
      ctx: {
        playerId: player.id,
        username: player.username,
        email: player.email
      }
    },
    'accepting terms'
  )
  return repositories.players.save({ ...player, termsAccepted: true })
}

async function findGravatar(
  /** @type {Partial<import('@tabulous/types').Player>} */ userDetails
) {
  if (!userDetails.email) {
    return undefined
  }
  const ctx = { email: userDetails.email }
  logger.trace({ ctx }, 'finding gravatar for user')
  // https://fr.gravatar.com/site/implement/hash/
  const hash = createHash('md5')
    .update(userDetails.email.trim().toLowerCase())
    .digest('hex')
  // https://fr.gravatar.com/site/implement/images/
  const avatar = `https://www.gravatar.com/avatar/${hash}?s=96&r=g&d=404`
  const response = await fetch(avatar)
  const gravatar = response.status === 200 ? avatar : undefined
  logger.trace({ ctx, res: gravatar }, 'found gravatar for user')
  return gravatar
}

/**
 * Returns the list of friends of a given player, including friendship requests, and blocked players.
 * @param {string} playerId - player id for who the list is returned.
 * @returns list (possibly empty) of friendship relationships for the specified player.
 */
export async function listFriends(playerId) {
  const ctx = { playerId }
  logger.trace({ ctx }, 'listing player friends')
  /** @type {import('@tabulous/types').Friendship[]} */
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
  logger.trace({ ctx, res: list }, 'listed player friends')
  return list
}

/**
 * Proposes a friendship request from one player to another one.
 * Publishes an update.
 * @param {import('@tabulous/types').Player} sender - sender player.
 * @param {string} playerId - id of the destination player.
 * @returns true if the request was proposed.
 */
export async function requestFriendship(sender, playerId) {
  const ctx = { playerId: sender.id, futureFriend: playerId }
  logger.trace({ ctx }, 'requesting friendship')
  if (!(await repositories.players.makeFriends(sender.id, playerId))) {
    return false
  }
  friendshipUpdates.next({ from: sender.id, to: playerId, requested: true })
  friendshipUpdates.next({ from: playerId, to: sender.id, proposed: true })
  logger.debug({ ctx }, 'requested friendship')
  return true
}

/**
 * Accepts a friendship request from another player.
 * Publishes an update.
 * @param {import('@tabulous/types').Player} sender - accepting player.
 * @param {string} playerId - id of the requesting player.
 * @returns true if the request was accepted.
 */
export async function acceptFriendship(sender, playerId) {
  const ctx = { playerId: sender.id, futureFriend: playerId }
  logger.trace({ ctx }, 'accepting friendship')
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
  logger.debug({ ctx }, 'accepted friendship')
  return true
}

/**
 * Declines a friendship request or ends existing friendship.
 * @param {import('@tabulous/types').Player} sender - declining player.
 * @param {string} playerId - id of the declined player.
 */
export async function endFriendship(sender, playerId) {
  const ctx = { playerId: sender.id, futureFriend: playerId }
  logger.trace({ ctx }, 'ending friendship')
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
  logger.debug({ ctx }, 'ended friendship')
  return true
}
