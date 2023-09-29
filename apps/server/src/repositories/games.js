// @ts-check
import {
  AbstractRepository,
  deserializeArray,
  deserializeNumber
} from './abstract-repository.js'

/** @extends AbstractRepository<import('@tabulous/types').GameData> */
class GameRepository extends AbstractRepository {
  static fields = [
    { name: 'created', deserialize: deserializeNumber },
    { name: 'playerIds', deserialize: deserializeArray },
    { name: 'guestIds', deserialize: deserializeArray }
  ]

  /**
   * Builds a repository to manage games.
   * The underlying structure is the same as AbstractRepository, plus:
   * - index:${name}:playerId:${playerId} are Redis Set holding game ids for a given player.
   */
  constructor() {
    super({ name: 'games' })
  }

  /**
   * Fetches game from a Redis Hash.
   * @override
   * @param {string} key - the Redis key.
   * @returns the corresponding model.
   */
  async _fetchModel(key) {
    const data = await super._fetchModel(key)
    if (data && 'otherFields' in data && typeof data.otherFields === 'string') {
      Object.assign(data, JSON.parse(data.otherFields))
      data.otherFields = undefined
    }
    return data
  }

  /**
   * Saves player as Redis Hash.
   * @override
   * @param {import('./abstract-repository').SaveModelContext<import('@tabulous/types').GameData>} context - the save operation context.
   */
  _saveModel({ transaction, model, key }) {
    const { id, created, playerIds, guestIds, ownerId, ...otherFields } = model
    transaction.hset(key, {
      id,
      created,
      ownerId,
      playerIds,
      guestIds,
      otherFields: JSON.stringify(otherFields)
    })
  }

  /**
   * Builds the key of the set holding all game ids of a given player.
   * @param {string} playerId - the concerned player id.
   * @returns the corresponding key.
   */
  _buildPlayerKey(playerId) {
    return `index:${this.name}:players:${playerId}`
  }

  /**
   * When saving games, updates guests' and players' respecive player sets of games.
   * @override
   * @param {import('./abstract-repository').SaveTransactionContext<import('@tabulous/types').GameData>} context - contextual information.
   */
  _enrichSaveTransaction(context) {
    const transaction = /** @type {import('ioredis').ChainableCommander} */ (
      super._enrichSaveTransaction(context)
    )
    removeGamesFromPlayerSets.call(this, transaction, context.existings)
    for (const game of context.models) {
      for (const playerId of [
        game?.ownerId,
        ...(game?.playerIds ?? []),
        ...(game?.guestIds ?? [])
      ]) {
        if (playerId && game) {
          transaction.sadd(this._buildPlayerKey(playerId), game.id)
        }
      }
    }
    return transaction
  }

  /**
   * When deleting games, removes them from player sets of games.
   * @override
   * @param {import('./abstract-repository').DeleteTransactionContext<import('@tabulous/types').GameData>} context - contextual information.
   */
  _enrichDeleteTransaction(context) {
    const transaction = /** @type {import('ioredis').ChainableCommander} */ (
      super._enrichDeleteTransaction(context)
    )
    removeGamesFromPlayerSets.call(this, transaction, context.models)
    return transaction
  }

  /**
   * Lists all games of a given player.
   * @param {string} playerId - id of the player for which games are returned.
   * @returns this player's games.
   */
  async listByPlayerId(playerId) {
    const ctx = { playerId }
    this.logger.trace({ ctx }, 'listing games by player')
    if (!this.client) {
      return []
    }
    const ids = await this.client.smembers(this._buildPlayerKey(playerId))
    const games = /** @type {import('@tabulous/types').GameData[]} */ (
      await this.getById(ids.sort())
    ).filter(Boolean)
    this.logger.debug(
      { ctx, res: games.map(({ kind, id }) => ({ id, kind })) },
      'listed games by player'
    )
    return games
  }
}

/**
 * @this {GameRepository}
 * @param {import('./abstract-repository').DeleteTransactionContext<import('@tabulous/types').GameData>['transaction']} transaction
 * @param {import('./abstract-repository').DeleteTransactionContext<import('@tabulous/types').GameData>['models']} models
 */
function removeGamesFromPlayerSets(transaction, models) {
  for (const game of models) {
    for (const playerId of [
      game?.ownerId,
      ...(game?.playerIds ?? []),
      ...(game?.guestIds ?? [])
    ]) {
      if (playerId && game) {
        transaction.srem(this._buildPlayerKey(playerId), game.id)
      }
    }
  }
}

/**
 * Game repository singleton.
 */
export const games = new GameRepository()
