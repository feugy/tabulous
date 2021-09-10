import services from '../services/index.js'
import { isAuthenticated } from './utils.js'

export default {
  Query: {
    /**
     * Returns the current player data from their authentication details.
     * Requires valid authentication.
     * @async
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments:
     * @param {object} context - graphQL context.
     * @returns {import('../services/authentication').Player|null} current player or null.
     */
    getCurrentPlayer: isAuthenticated((obj, args, { player }) => player),

    /**
     * Returns players (except the current one) which username contains searched text.
     * Requires valid authentication.
     * @async
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments, including:
     * @param {string} args.search - searched text.
     * @param {object} context - graphQL context.
     * @returns {import('../services/authentication').Player[]} list (potentially empty) of matching players.
     */
    searchPlayers: isAuthenticated((obj, { search }, { player }) =>
      services.searchPlayers(search, player.id)
    )
  },

  Mutation: {
    /**
     * Authenticate an user from their username.
     * @async
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {string} data.username - username.
     * @param {string} data.password - clear password.
     * @returns {import('../services/authentication').Player|null} authentified player or null.
     */
    logIn: (obj, { username, password }) => services.logIn(username, password)
  }
}
