// @ts-check
import {
  count,
  create,
  insertMultiple,
  removeMultiple,
  search
} from '@orama/orama'

import {
  AbstractRepository,
  deserializeArray,
  deserializeBoolean
} from './abstract-repository.js'

/** @typedef {?import('@orama/orama').Orama<{ Schema: { username: 'string', fullName: 'string', email: 'string' } }>} SearchIndex */

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

/** @extends AbstractRepository<import('@tabulous/types').Player> */
class PlayerRepository extends AbstractRepository {
  static fields = [
    // enforce no game id to be null
    {
      name: 'currentGameId',
      deserialize: (/** @type {string} */ value) => value || null
    },
    { name: 'isAdmin', deserialize: deserializeBoolean },
    { name: 'termsAccepted', deserialize: deserializeBoolean },
    { name: 'catalog', deserialize: deserializeArray },
    { name: 'usernameSearchable', deserialize: deserializeBoolean }
  ]

  /**
   * Builds a repository to manage players.
   * The underlying structure is the same as AbstractRepository, plus:
   * - index:${name}:providers:${provider}:${providerId} are Redis strings holding player id for a given provider id.
   * - friends:${id} are Redis sorted set holding a player's list of friend ids (members) and friendship state (score).
   */
  constructor() {
    super({ name: 'players' })
    /** @type {SearchIndex} */
    this.searchIndex = null
  }

  /**
   * In addition to connecting to the Database, also connects to the search index.
   * @override
   * @param {{ url: string, isProduction?: boolean }} args - connection arguments.
   */
  async connect(args) {
    await super.connect(args)
    await this.reindexModels()
  }

  /**
   * In addition to disconnecting from the Database, also disconnect the search index.
   * @override
   */
  async release() {
    await super.release()
    this.searchIndex = null
  }

  /**
   * Builds the key of the string holding player id for a given provider id.
   * @param {Pick<import('@tabulous/types').Player, 'provider'|'providerId'>} details - the desired provider details.
   * @returns the corresponding key.
   */
  _buildProviderIdKey({ provider, providerId }) {
    return `index:${this.name}:providers:${provider}:${providerId}`
  }

  /**
   * Builds the key a player's friends list.
   * @protected
   * @param {string} id - the concerned model id.
   * @returns the corresponding key.
   */
  _buildFriendsKey(id) {
    return `friends:${id}`
  }

  /**
   * When saving players, add their provider id references, and updates their username for autocompletion.
   * @override
   * @param {import('./abstract-repository').SaveTransactionContext<import('@tabulous/types').Player>} context - contextual information.
   */
  async _enrichSaveTransaction(context) {
    const transaction = /** @type {import('ioredis').ChainableCommander} */ (
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
    await removeFromIndex(this.searchIndex, existings, this.logger)
    await insertIntoIndex(this.searchIndex, models, this.logger)
    return transaction
  }

  /**
   * When deleting players, removes their provider id references and username for autocompletion.
   * @override
   * @param {import('./abstract-repository').DeleteTransactionContext<import('@tabulous/types').Player>} context - contextual information.
   */
  async _enrichDeleteTransaction(context) {
    const transaction = /** @type {import('ioredis').ChainableCommander} */ (
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
    await removeFromIndex(this.searchIndex, context.models, this.logger)
    for (const player of context.models) {
      if (player) {
        for (const id of await /** @type {import('ioredis').Redis} */ (
          this.client
        ).zrange(this._buildFriendsKey(player.id), 0, -1)) {
          transaction.zrem(this._buildFriendsKey(id), player.id)
        }
      }
    }
    return transaction
  }

  /**
   * Finds a player by their provider and providerId details.
   * @param {Pick<import('@tabulous/types').Player, 'provider'|'providerId'>} details - the desired provider details.
   * @returns the corresponding player or null.
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
   * Only players who enabled username searchability could be retrieved, unless running an exact search.
   * @param {object} args - search arguments, including:
   * @param {string} args.search - searched text
   * @param {number} [args.from = 0] - 0-based index of the first result
   * @param {number} [args.size = 10] - maximum number of models returned after first results.
   * @param {boolean} [args.exact = false] - for exact search (un-searchable players can be retrieved).
   * @returns {Promise<import('./abstract-repository').Page<import('@tabulous/types').Player>>} a given page of matching players.
   */
  async searchByUsername({ search: term, from = 0, size = 10, exact = false }) {
    const ctx = { search, from, size, exact }
    this.logger.trace({ ctx }, 'finding players')
    /** @type {import('@tabulous/types').Player[]} */
    let results = []
    let total = 0
    if (this.searchIndex) {
      let { hits, count } = await search(this.searchIndex, {
        term,
        properties: ['username'],
        limit: size,
        offset: from,
        ...(exact ? { exact: true } : { where: { usernameSearchable: true } })
      })
      if (exact) {
        const lowerCaseTerm = term.toLowerCase().trim()
        hits = hits.filter(
          ({ document: { username } }) =>
            /** @type {string} */ (username).toLowerCase().trim() ===
            lowerCaseTerm
        )
        count = hits.length
      }
      total = count
      results = /** @type {import('@tabulous/types').Player[]} */ (
        await this.getById(hits.map(({ id }) => id))
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
   * Resets search index to match models in database
   */
  async reindexModels() {
    this.logger.trace('re-indexing all models')

    this.searchIndex = await create({
      id: 'id',
      schema: {
        username: 'string',
        fullName: 'string',
        email: 'string',
        usernameSearchable: 'boolean'
      },
      components: { tokenizer: { stemming: false } }
    })

    async function* listAll(
      /** @type {typeof PlayerRepository.prototype.list} */ list
    ) {
      const size = 100
      let total = 1
      for (let from = 0; from < total; from += size) {
        const page = await list({ from, size })
        total = page.total
        yield page.results
      }
    }

    const allPlayers = []
    for await (const players of listAll(this.list.bind(this))) {
      allPlayers.push(...players)
    }
    await insertIntoIndex(this.searchIndex, allPlayers, this.logger)
    const total = await count(this.searchIndex)
    this.logger.debug({ res: total }, 're-indexed all models')
  }
  /**
   * Connects two players as friends.
   * Order matters when requesting/declining relationship: first player is requesting/delining the second one.
   * @param {string} requestingId - if of the requesting player.
   * @param {string} targetedId - if of the targeted player
   * @param {number} [state = Friendship] - state of the current relationship.
   * @returns true if the relationship was recorded.
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
    const transaction = /** @type {import('ioredis').Redis} */ (
      this.client
    ).multi()
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
   * @returns list of relationships.
   */
  async listFriendships(playerId) {
    this.logger.trace({ ctx: { playerId } }, 'listing friendships')
    let id = ''
    if (!this.client) {
      return []
    }
    /** @type {Friendship[]} */
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
 * @param {SearchIndex} searchIndex
 * @param {import('@tabulous/types').Player[]} models
 * @param {import('pino').Logger} logger
 */
async function insertIntoIndex(searchIndex, models, logger) {
  if (searchIndex) {
    const ctx = { insertedIds: models.map(({ id }) => id) }
    logger.trace({ ctx }, 'inserting documents into search index')
    const inserted = await insertMultiple(
      searchIndex,
      /** @type {Record<string, ?>[]} */ (models)
    )
    logger.debug({ ctx, res: inserted }, 'inserted documents into search index')
  }
}

/**
 * @param {SearchIndex} searchIndex
 * @param {(?import('@tabulous/types').Player)[]} models
 * @param {import('pino').Logger} logger
 */
async function removeFromIndex(searchIndex, models, logger) {
  if (searchIndex) {
    const removedIds = /** @type {import('@tabulous/types').Player[]} */ (
      models.filter(Boolean)
    ).map(({ id }) => id)
    if (removedIds.length) {
      const ctx = { removedIds }
      logger.trace({ ctx }, 'removing documents from search index')
      const removed = await removeMultiple(searchIndex, removedIds)
      logger.debug({ ctx, res: removed }, 'removed documents from search index')
    }
  }
}
