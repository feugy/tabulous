import {
  AbstractRepository,
  deserializeArray,
  deserializeBoolean
} from './abstract-repository.js'

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

class PlayerRepository extends AbstractRepository {
  static fields = [
    // enforce no game id to be null
    { name: 'currentGameId', deserialize: value => value || null },
    { name: 'isAdmin', deserialize: deserializeBoolean },
    { name: 'termsAccepted', deserialize: deserializeBoolean },
    { name: 'catalog', deserialize: deserializeArray }
  ]

  /**
   * Builds a repository to manage players.
   * The underlying structure is the same as AbstractRepository, plus:
   * - index:${name}:providers:${provider}:${providerId} are Redis strings holding player id for a given provider id.
   * - friends:${id} are Redis sorted set holding a player's list of friend ids (members) and friendship state (score).
   * @returns {PlayerRepository} a repository for player models.
   */
  constructor() {
    super({ name: 'players' })
    this.usernameAutocompleteKey = 'autocomplete:players:username'
  }

  /**
   * Builds the key of the string holding player id for a given provider id.
   * @param {object} player - the player details, including:
   * @param {string} player.provider - name of the provider.
   * @param {string} player.providerId - provider id for this player
   * @returns {string} the corresponding key.
   */
  _buildProviderIdKey({ provider, providerId }) {
    return `index:${this.name}:providers:${provider}:${providerId}`
  }

  /**
   * Builds the key a player's friends list.
   * @private
   * @param {string} id - the concerned model id.
   * @returns {string} the corresponding key.
   */
  _buildFriendsKey(id) {
    return `friends:${id}`
  }

  /**
   * When saving players, add their provider id references, and updates their username for autocompletion.
   * @private
   * @param {AbstractRepository.SaveTransactionContext} context - contextual information.
   * @returns {AbstractRepository.Transaction} the applied transaction.
   */
  _enrichSaveTransaction(context) {
    const transaction = super._enrichSaveTransaction(context)
    const { models, existings } = context
    const references = models
      .map(player =>
        player?.provider ? [this._buildProviderIdKey(player), player.id] : null
      )
      .filter(Boolean)
    if (references.length) {
      transaction.mset(...references)
    }
    const oldUsernames = existings
      .map(player => buildUsernameAutocomplete(player))
      .filter(Boolean)
    if (oldUsernames.length) {
      transaction.zrem(this.usernameAutocompleteKey, ...oldUsernames)
    }
    const newUsernames = models
      .map(player => buildUsernameAutocomplete(player))
      .filter(Boolean)
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
   * @private
   * @param {AbstractRepository.DeleteTransactionContext} context - contextual information.
   * @returns {AbstractRepository.Transaction} the applied transaction.
   */
  async _enrichDeleteTransaction(context) {
    const transaction = super._enrichDeleteTransaction(context)
    const references = context.models
      .flatMap(player =>
        player
          ? [this._buildProviderIdKey(player), this._buildFriendsKey(player.id)]
          : null
      )
      .filter(Boolean)
    if (references.length) {
      transaction.del(...references)
    }
    const usernames = context.models
      .map(player => buildUsernameAutocomplete(player))
      .filter(Boolean)
    if (usernames.length) {
      transaction.zrem(this.usernameAutocompleteKey, ...usernames)
    }
    for (const player of context.models) {
      if (player) {
        for (const id of await this.client.zrange(
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
   * @param {object} player - the desired provider details, including:
   * @param {string} player.provider - name of the provider.
   * @param {string} player.providerId - provider id for this player
   * @returns {Promise<object|null>} the corresponding player or null.
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
   * @param {number} [args.exact = false] - for exact search.
   * @returns {Promise<import('./abstract-repository').Page>} a given page of matching players.
   */
  async searchByUsername({ search, from = 0, size = 10, exact = false } = {}) {
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
      results = await this.getById(
        matching.slice(from, from + size).map(result => result.split(':')[1])
      )
    }
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
    if (
      (await this.getById([requestingId, targetedId])).filter(Boolean)
        .length !== 2
    ) {
      return false
    }
    const transaction = this.client.multi()
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
    return result[1][1] === 1
  }

  /**
   * List friendship relationships with other players.
   * @param {string} playerId - player for which friends are being fetched.
   * @returns {Promise<Friendship[]>} list of relationships.
   */
  async listFriendships(playerId) {
    let id = null
    return (
      await this.client.zrevrange(
        this._buildFriendsKey(playerId),
        0,
        -1,
        'WITHSCORES'
      )
    ).reduce((list, value, rank) => {
      if (rank % 2) {
        list.push({ id, state: +value })
      } else {
        id = value
      }
      return list
    }, [])
  }
}

/**
 * Player repository singleton.
 * @type {PlayerRepository}
 */
export const players = new PlayerRepository()

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

function buildUsernameAutocomplete(player) {
  return player?.username
    ? `${normalizeString(player.username)}:${player.id}`
    : null
}
