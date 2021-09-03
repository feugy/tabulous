import services from '../services/index.js'

export default {
  Mutation: {
    /**
     * Authenticate an user from their username.
     * @async
     * @param {object} args - mutation arguments, including:
     * @param {string} data.username - username.
     * @param {string} data.password - clear password.
     * @returns {import('../services/authentication').Player|null} authentified player or null.
     */
    logIn: (_, { username, password }) => services.logIn(username, password)
  }
}
