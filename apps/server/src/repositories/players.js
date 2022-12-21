import {
  AbstractRepository,
  deserializeArray,
  deserializeBoolean
} from './abstract-repository.js'

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
   * When saving players, add their provider id references, and updates their username for autocompletion.
   * @private
   * @param {AbstractRepository.SaveTransactionContext} context - contextual information.
   * @returns {AbstractRepository.Transaction} the applied transaction.
   */
  _enrichSaveTransaction(context) {
    const transaction = super._enrichDeleteTransaction(context)
    const { models, existings } = context
    const references = models
      .map(player =>
        player ? [this._buildProviderIdKey(player), player.id] : null
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
  _enrichDeleteTransaction(context) {
    const transaction = super._enrichDeleteTransaction(context)
    const references = context.models
      .map(player => (player ? this._buildProviderIdKey(player) : null))
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
    return transaction
  }

  /**
   * Finds a player by their provider and providerId details.
   * @async
   * @param {object} player - the desired provider details, including:
   * @param {string} player.provider - name of the provider.
   * @param {string} player.providerId - provider id for this player
   * @returns {object|null} the corresponding player or null.
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
   * @async
   * @param {object} args - search arguments, including:
   * @param {string} args.search - searched text
   * @param {number} [args.from = 0] - 0-based index of the first result
   * @param {number} [args.size = 10] - maximum number of models returned after first results.
   * @param {number} [args.exact = false] - for exact search.
   * @returns {import('./abstract-repository').Page} a given page of matching players.
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
