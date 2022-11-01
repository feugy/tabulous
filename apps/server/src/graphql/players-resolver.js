import { makeToken } from '../plugins/utils.js'
import services from '../services/index.js'
import { isAdmin, isAuthenticated } from './utils.js'
import { hash } from '../utils/index.js'

export default {
  Query: {
    /**
     * Returns the current player data from their authentication details.
     * Requires valid authentication.
     * @async
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments:
     * @param {object} context - graphQL context.
     * @returns {import('../services/authentication').PlayerWithTurnCredentials} current player with turn credentials.
     */
    getCurrentPlayer: isAuthenticated((obj, args, { player, conf, token }) => {
      const turnCredentials = services.generateTurnCredentials(conf.turn.secret)
      return { token, player, turnCredentials }
    }),

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
    searchPlayers: isAuthenticated(
      (obj, { search, includeCurrent }, { player }) =>
        services.searchPlayers(search, player.id, !includeCurrent)
    )
  },

  Mutation: {
    /**
     * Create a new player account that can connect with a password value.
     * The clear password provided is hashed before being stored.
     * Requires authentication and elevated privileges.
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments.
     * @returns {Promise<import('../services/authentication').Player>} the created player.
     */
    addPlayer: isAdmin(async (obj, { id, username, password }) =>
      services.addPlayer({ id, username, password: hash(password) })
    ),

    /**
     * Authenticates an user from their user id.
     * Returns a token to allow browser issueing authenticated requests.
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {string} data.id - user account id.
     * @param {string} data.password - clear password.
     * @param {object} context - graphQL context.
     * @returns {Promise<import('./players.graphqk').PlayerWithTurnCredentials>} authentified player with turn credentials.
     */
    logIn: async (obj, { id, password }, { conf }) => {
      const player = await services.getPlayerById(id)
      if (!player || !player.password || hash(password) !== player.password) {
        throw new Error('forbidden')
      }
      const turnCredentials = services.generateTurnCredentials(conf.turn.secret)
      const token = makeToken(player, conf.auth.jwt)
      return { token, player, turnCredentials }
    },

    /**
     * Record an user accepting the terms of service.
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, empty.
     * @param {object} context - graphQL context.
     * @returns {Promise<import('./players.graphqk').Player>} authentified player with turn credentials.
     */
    acceptTerms: isAuthenticated((obj, args, { player }) =>
      services.acceptTerms(player)
    )
  }
}
