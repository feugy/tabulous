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
}

/**
 * Player repository singleton.
 * @type {PlayerRepository}
 */
export const players = new PlayerRepository()
