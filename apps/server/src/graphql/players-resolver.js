import { createHash } from 'crypto'
import { setTokenCookie } from '../plugins/utils.js'
import services from '../services/index.js'
import { isAuthenticated } from './utils.js'

const masterPassword = hash('ehfada')

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
     * Authenticates an user from their username.
     * Sets id cookie to allow browser issueing authenticated requests.
     * @async
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {string} data.username - username.
     * @param {string} data.password - clear password.
     * @param {object} context - graphQL context.
     * @returns {import('./players.graphqk').PlayerWithTurnCredentials} authentified player with turn credentials.
     */
    logIn: async (obj, { username, password }, { conf, reply }) => {
      if (masterPassword !== hash(password)) {
        throw new Error('forbidden')
      }
      const player = await services.connect({ username })
      const turnCredentials = services.generateTurnCredentials(conf.turn.secret)
      const token = setTokenCookie(reply, player, conf.auth.jwt)
      return { token, player, turnCredentials }
    },

    /**
     * Clears out authentication cookie
     */
    logOut: (obj, args, { reply }) => {
      reply.clearCookie('token')
    }
  }
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}
