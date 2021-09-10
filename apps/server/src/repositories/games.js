import { AbstractRepository } from './abstract-repository.js'

class GameRepository extends AbstractRepository {
  /**
   * Builds a repository to manage games.
   * @returns {GameRepository} a repository for game models.
   */
  constructor() {
    super({ name: 'games' })
  }

  /**
   * Lists games of a given player with pagination.
   * @async
   * @param {object} args - list arguments, including:
   * @param {number} [args.from = 0] - 0-based index of the first result
   * @param {number} [args.size = 10] - maximum number of models returned after first results.
   * @returns {import('./abstract-repository').Page} a given page of games.
   */
  async listByPlayerId(playerId, { from = 0, size = 10 } = {}) {
    let i = 0
    const results = []
    for (const [, model] of this.modelsById) {
      if (model.playerIds.includes(playerId)) {
        if (i >= from && i < from + size) {
          results.push(model)
        }
        i++
      }
    }
    return { total: i, from, size, results }
  }
}

/**
 * Game repository singleton.
 * @type {GameRepository}
 */
export const games = new GameRepository()
