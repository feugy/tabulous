import services from '../services/index.js'
import { isAuthenticated } from './utils.js'

export default {
  Query: {
    /**
     * Returns the current player data from their authentication details.
     * Requires valid authentication.
     * @async
     * @returns {import('../services/authentication').Player|null} current player or null.
     */
    getCurrentPlayer: isAuthenticated((obj, args, { player }) => player)
  },

  Mutation: {
    /**
     * Authenticate an user from their username.
     * @async
     * @param {object} args - mutation arguments, including:
     * @param {string} data.username - username.
     * @param {string} data.password - clear password.
     * @returns {import('../services/authentication').Player|null} authentified player or null.
     */
    logIn: (obj, { username, password }) => services.logIn(username, password)
  }
}
