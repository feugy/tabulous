import services from '../services/index.js'

export default {
  Mutation: {
    /**
     * Authenticate an user from their username.
     * @async
     * @param {object} args - mutation arguments, including:
     * @param {string} data.username - username.
     * @returns {import('../services/authentication').Player|null} authentified player or null.
     */
    logIn: (_, { username }) => services.logIn(username)
  }
}
