import {
  AbstractRepository,
  deserializeArray,
  deserializeNumber
} from './abstract-repository.js'

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
   * @returns {GameRepository} a repository for game models.
   */
  constructor() {
    super({ name: 'games' })
  }

  /**
   * Fetches game from a Redis Hash.
   * @param {string} key - the Redis key.
   * @returns {Promise<object>} the corresponding model.
   */
  async _fetchModel(key) {
    const data = await super._fetchModel(key)
    if (data && 'otherFields' in data) {
      Object.assign(data, JSON.parse(data.otherFields))
      data.otherFields = undefined
    }
    return data
  }

  /**
   * Saves player as Redis Hash.
   * @private
   * @param {AbstractRepository.SaveModelContext} context - contextual information.
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
   * @returns {string} the corresponding key.
   */
  _buildPlayerKey(playerId) {
    return `index:${this.name}:players:${playerId}`
  }

  /**
   * When saving games, adds the new ones into their respecive player sets of games.
   * @private
   * @param {AbstractRepository.SaveTransactionContext} context - contextual information.
   * @returns {Transaction} the applied transaction.
   */
  _enrichSaveTransaction(context) {
    const transaction = super._enrichSaveTransaction(context)
    for (const game of context.models) {
      for (const playerId of [
        ...(game?.playerIds ?? []),
        ...(game?.guestIds ?? [])
      ]) {
        transaction.sadd(this._buildPlayerKey(playerId), game.id)
      }
    }
    return transaction
  }

  /**
   * When deleting games, removes them from player sets of games.
   * @private
   * @param {AbstractRepository.DeleteTransactionContext} context - contextual information.
   * @returns {Transaction} the applied transaction.
   */
  _enrichDeleteTransaction(context) {
    const transaction = super._enrichDeleteTransaction(context)
    for (const game of context.models) {
      for (const playerId of [
        ...(game?.playerIds ?? []),
        ...(game?.guestIds ?? [])
      ]) {
        transaction.srem(this._buildPlayerKey(playerId), game.id)
      }
    }
    return transaction
  }

  /**
   * Lists all games of a given player.
   * @async
   * @param {object} playerId - id of the player for which games are returned.
   * @returns {object[]} this player's games.
   */
  async listByPlayerId(playerId) {
    if (!this.client) {
      return []
    }
    const ids = await this.client.smembers(this._buildPlayerKey(playerId))
    return this.getById(ids.sort())
  }
}

/**
 * Game repository singleton.
 * @type {GameRepository}
 */
export const games = new GameRepository()
