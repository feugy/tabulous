// @ts-check
import {
  AbstractRepository,
  deserializeArray,
  deserializeBoolean
} from './abstract-repository.js'

/** @typedef {import('../services/players.js').Player} Player */
/** @typedef {import('./abstract-repository.js').SaveTransactionContext<Player>} SaveTransactionContext */
/** @typedef {import('./abstract-repository.js').DeleteTransactionContext<Player>} DeleteTransactionContext */
/** @typedef {import('ioredis').Redis} Redis */

/**
 * State (Redis score) when friendship when proposed to someone else.
 */
export const FriendshipProposed = 0
/**
 * State (Redis score) when friendship when requested by someone else.
 */
export const FriendshipRequested = 1
/**
 * State (Redis score) of the friendship relationship when confirmed by both parties.
 */
export const FriendshipAccepted = 2
/**
 * State (Redis score) when friendship with someone else was blocked.
 */
export const FriendshipBlocked = 3
/**
 * Value used to decline friendship (Removes request from Redis sorted set).
 */
export const FriendshipEnded = 4

/**
 * @typedef {object} Friendship relationship with another player
 * @property {string} id - id of a targeted player.
 * @property {number} state - state of the relationship.
 */

/** @extends AbstractRepository<Player> */
class PlayerRepository extends AbstractRepository {
  static fields = [
    // enforce no game id to be null
    {
      name: 'currentGameId',
      deserialize: (/** @type {string} */ value) => value || null
    },
    { name: 'isAdmin', deserialize: deserializeBoolean },
    { name: 'termsAccepted', deserialize: deserializeBoolean },
    { name: 'catalog', deserialize: deserializeArray }
  ]

  /**
   * Builds a repository to manage players.
   * The underlying structure is the same as AbstractRepository, plus:
   * - index:${name}:providers:${provider}:${providerId} are Redis strings holding player id for a given provider id.
   * - friends:${id} are Redis sorted set holding a player's list of friend ids (members) and friendship state (score).
   */
  constructor() {
    super({ name: 'players' })
    this.usernameAutocompleteKey = 'autocomplete:players:username'
  }

  /**
   * Builds the key of the string holding player id for a given provider id.
   * @param {Pick<Player, 'provider'|'providerId'>} details - the desired provider details.
   * @returns {string} the corresponding key.
   */
  _buildProviderIdKey({ provider, providerId }) {
    return `index:${this.name}:providers:${provider}:${providerId}`
  }

  /**
   * Builds the key a player's friends list.
   * @protected
   * @param {string} id - the concerned model id.
   * @returns {string} the corresponding key.
   */
  _buildFriendsKey(id) {
    return `friends:${id}`
  }

  /**
   * When saving players, add their provider id references, and updates their username for autocompletion.
   * @override
   * @param {SaveTransactionContext} context - contextual information.
   */
  _enrichSaveTransaction(context) {
    const transaction =
      /** @type {import('./abstract-repository.js').Transaction} */ (
        super._enrichSaveTransaction(context)
      )
    const { models, existings } = context
    const references = /** @type {[string[]]} */ (
      models
        .map(player =>
          player?.provider
            ? [this._buildProviderIdKey(player), player.id]
            : null
        )
        .filter(Boolean)
    )
    if (references.length) {
      transaction.mset(...references)
    }
    const oldUsernames = /** @type {string[]} */ (
      existings.map(player => buildUsernameAutocomplete(player)).filter(Boolean)
    )
    if (oldUsernames.length) {
      transaction.zrem(this.usernameAutocompleteKey, ...oldUsernames)
    }
    const newUsernames = /** @type {string[]} */ (
      models.map(player => buildUsernameAutocomplete(player)).filter(Boolean)
    )
    if (newUsernames.length) {
      transaction.zadd(
        this.usernameAutocompleteKey,
        ...newUsernames.flatMap(username => [0, username])
      )
    }
    return transaction
  }

  /**
   * When deleting players, removes their provider id references and username for autocompletion.
   * @override
   * @param {DeleteTransactionContext} context - contextual information.
   */
  async _enrichDeleteTransaction(context) {
    const transaction =
      /** @type {import('./abstract-repository.js').Transaction} */ (
        super._enrichDeleteTransaction(context)
      )
    const references = /** @type {string[]} */ (
      context.models
        .flatMap(player =>
          player
            ? [
                this._buildProviderIdKey(player),
                this._buildFriendsKey(player.id)
              ]
            : null
        )
        .filter(Boolean)
    )
    if (references.length) {
      transaction.del(...references)
    }
    const usernames = /** @type {string[]} */ (
      context.models
        .map(player => buildUsernameAutocomplete(player))
        .filter(Boolean)
    )
    if (usernames.length) {
      transaction.zrem(this.usernameAutocompleteKey, ...usernames)
    }
    for (const player of context.models) {
      if (player) {
        for (const id of await /** @type {Redis} */ (this.client).zrange(
          this._buildFriendsKey(player.id),
          0,
          -1
        )) {
          transaction.zrem(this._buildFriendsKey(id), player.id)
        }
      }
    }
    return transaction
  }

  /**
   * Finds a player by their provider and providerId details.
   * @param {Pick<Player, 'provider'|'providerId'>} details - the desired provider details.
   * @returns {Promise<?Player>} the corresponding player or null.
   */
  async getByProviderDetails(details) {
    if (!this.client) {
      return null
    }
    const id = await this.client.get(this._buildProviderIdKey(details))
    return id ? this.getById(id) : null
  }

  /**
   * Finds players starting with a (or being the same exact) text in their username.
   * @param {object} args - search arguments, including:
   * @param {string} args.search - searched text
   * @param {number} [args.from = 0] - 0-based index of the first result
   * @param {number} [args.size = 10] - maximum number of models returned after first results.
   * @param {boolean} [args.exact = false] - for exact search.
   * @returns {Promise<import('./abstract-repository').Page<Player>>} a given page of matching players.
   */
  async searchByUsername({ search, from = 0, size = 10, exact = false }) {
    const ctx = { search, from, size, exact }
    this.logger.trace({ ctx }, 'finding players')
    /** @type {Player[]} */
    let results = []
    let total = 0
    if (this.client) {
      const seed = normalizeString(search)
      const matching = await this.client.zrangebylex(
        this.usernameAutocompleteKey,
        `[${seed}${exact ? ':' : ''}`,
        `[${seed}${exact ? ':{' : '{'}`
      )
      total = matching.length
      results = /** @type {Player[]} */ (
        await this.getById(
          matching.slice(from, from + size).map(result => result.split(':')[1])
        )
      )
    }
    this.logger.debug(
      {
        ctx,
        res: {
          total,
          results: results.map(({ id, username }) => ({ id, username }))
        }
      },
      'found players'
    )
    return { total, from, size, results }
  }

  /**
   * Connects two players as friends.
   * Order matters when requesting/declining relationship: first player is requesting/delining the second one.
   * @param {string} requestingId - if of the requesting player.
   * @param {string} targetedId - if of the targeted player
   * @param {number} [state = Friendship] - state of the current relationship.
   * @returns {Promise<boolean>} true if the relationship was recorded.
   */
  async makeFriends(requestingId, targetedId, state = FriendshipRequested) {
    const ctx = { requestingId, targetedId, state }
    this.logger.trace({ ctx }, 'updating friendships')
    if (
      (await this.getById([requestingId, targetedId])).filter(Boolean)
        .length !== 2
    ) {
      return false
    }
    const transaction = /** @type {Redis} */ (this.client).multi()
    const targetedKey = this._buildFriendsKey(targetedId)
    const requestingKey = this._buildFriendsKey(requestingId)
    if (state === FriendshipEnded) {
      transaction.zrem(requestingKey, targetedId)
    } else if (state !== FriendshipRequested) {
      transaction.zadd(requestingKey, 'GT', 'CH', state, targetedId)
    } else {
      transaction.zadd(
        requestingKey,
        'GT',
        'CH',
        FriendshipProposed,
        targetedId
      )
    }

    if (state === FriendshipEnded || state === FriendshipBlocked) {
      transaction.zrem(targetedKey, requestingId)
    } else {
      transaction.zadd(targetedKey, 'GT', 'CH', state, requestingId)
    }
    const result = await transaction.exec()
    // first result is for requesting player, second for targeted player
    // the operation was successful if the targeted player was updated
    const successful = result?.[1][1] === 1
    this.logger.debug({ ctx, res: successful }, 'updated friendships')
    return successful
  }

  /**
   * List friendship relationships with other players.
   * @param {string} playerId - player for which friends are being fetched.
   * @returns {Promise<Friendship[]>} list of relationships.
   */
  async listFriendships(playerId) {
    this.logger.trace({ ctx: { playerId } }, 'listing friendships')
    let id = ''
    if (!this.client) {
      return []
    }
    const friendships = (
      await this.client.zrevrange(
        this._buildFriendsKey(playerId),
        0,
        -1,
        'WITHSCORES'
      )
    ).reduce(
      (/** @type {{ id: String, state: number }[]} */ list, value, rank) => {
        if (rank % 2) {
          list.push({ id, state: +value })
        } else {
          id = value
        }
        return list
      },
      []
    )
    this.logger.debug(
      { ctx: { playerId }, res: friendships },
      'listed friendships'
    )
    return friendships
  }
}

/**
 * Player repository singleton.
 */
export const players = new PlayerRepository()

/**
 * @param {string} str
 * @returns {string}
 */
function normalizeString(str) {
  return (
    str
      .trim()
      // https://stackoverflow.com/a/37511463/1182976
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
  )
}

/**
 * @param {?Player} player
 * @returns {?string}
 */
function buildUsernameAutocomplete(player) {
  return player?.username
    ? `${normalizeString(player.username)}:${player.id}`
    : null
}
