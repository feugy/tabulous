import { AbstractRepository } from './abstract-repository.js'

class PlayerRepository extends AbstractRepository {
  /**
   * Builds a repository to manage players.
   * @returns {PlayerRepository} a repository for player models.
   */
  constructor() {
    super({ name: 'players' })
  }

  /**
   * Finds a player by their username.
   * @async
   * @param {string} username - desired username.
   * @returns {object|null} the corresponding player or null.
   */
  async getByUsername(username) {
    for (const [, player] of this.modelsById) {
      if (player.username === username) {
        return player
      }
    }
    return null
  }

  /**
   * Finds a player by their provider and providerId details.
   * @async
   * @param {string} provider - desired provider.
   * @param {any} providerId - desired providerId.
   * @returns {object|null} the corresponding player or null.
   */
  async getByProviderDetails({ provider, providerId }) {
    for (const [, player] of this.modelsById) {
      if (player.provider === provider && player.providerId === providerId) {
        return player
      }
    }
    return null
  }

  /**
   * Finds players containing a given seed in their username.
   * @async
   * @param {object} args - search arguments, including:
   * @param {string} args.search - searched text
   * @param {number} [args.from = 0] - 0-based index of the first result
   * @param {number} [args.size = 10] - maximum number of models returned after first results.
   * @returns {import('./abstract-repository').Page} a given page of matching players.
   */
  async searchByUsername({ search, from = 0, size = 10 } = {}) {
    const results = []
    let total = 0
    let i = 0
    const lowerSeed = search.toLowerCase().trim()
    for (const [, player] of this.modelsById) {
      if (player.username.toLowerCase().includes(lowerSeed)) {
        total++
        if (from <= i && i < from + size) {
          results.push(player)
        }
        i++
      }
    }
    return { total, from, size, results }
  }
}

/**
 * Player repository singleton.
 * @type {PlayerRepository}
 */
export const players = new PlayerRepository()
