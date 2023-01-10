import { makeToken } from '../plugins/utils.js'
import repositories from '../repositories/index.js'
import services from '../services/index.js'
import { hash } from '../utils/index.js'
import { isAdmin, isAuthenticated } from './utils.js'

/** @typedef {import('./players.graphql').PlayerWithTurnCredentials} PlayerWithTurnCredentials */
/** @typedef {import('../services/players').Player} Player */
/** @typedef {import('../repositories/abstract-repository.js').Page} PlayerPage */

export default {
  Query: {
    /**
     * Returns the current player data from their authentication details.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments:
     * @param {object} context - graphQL context.
     * @returns {Promise<PlayerWithTurnCredentials>} current player with turn credentials.
     */
    getCurrentPlayer: isAuthenticated((obj, args, { player, conf, token }) => {
      const turnCredentials = services.generateTurnCredentials(conf.turn.secret)
      return { token, player, turnCredentials }
    }),

    /**
     * Returns players (except the current one) which username contains searched text.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments, including:
     * @param {string} args.search - searched text.
     * @param {object} context - graphQL context.
     * @returns {Promise<Player[]>} list (potentially empty) of matching players.
     */
    searchPlayers: isAuthenticated(
      (obj, { search, includeCurrent }, { player }) =>
        services.searchPlayers(search, player.id, !includeCurrent)
    ),

    /**
     * Returns a page or players.
     * Requires authentication and elevated privileges.
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments, including:
     * @param {number} args.from - index of the first result returned.
     * @param {number} args.size - number of return results.
     * @param {object} context - graphQL context.
     * @returns {Promise<PlayerPage>} extract of the player list.
     */
    listPlayers: isAdmin((obj, args) => repositories.players.list(args)),

    /**
     * Returns the list of friends of a given player.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments.
     * @param {object} context - graphQL context.
     * @returns {Promise<Player[]>} list (potentially empty) of friend players.
     */
    getFriendList: isAuthenticated((obj, args, { player }) =>
      services.getFriendList(player.id)
    )
  },

  Mutation: {
    /**
     * Create a new player account that can connect with a password value.
     * The clear password provided is hashed before being stored.
     * Requires authentication and elevated privileges.
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments.
     * @returns {Promise<Player>} the created player.
     */
    addPlayer: isAdmin(async (obj, { id, username, password }) =>
      services.upsertPlayer({ id, username, password: hash(password) })
    ),

    /**
     * Authenticates an user from their user id.
     * Returns a token to allow browser issueing authenticated requests.
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {string} data.id - user account id.
     * @param {string} data.password - clear password.
     * @param {object} context - graphQL context.
     * @returns {Promise<PlayerWithTurnCredentials>} authentified player with turn credentials.
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
     * @returns {Promise<Player>} authentified player with turn credentials.
     */
    acceptTerms: isAuthenticated((obj, args, { player }) =>
      services.acceptTerms(player)
    ),

    /**
     * Updates current player's details.
     * Requires authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments, including:
     * @param {string} [args.username] - new username value, if any.
     * @param {string} [args.avatar] - new avatar value, if any.
     * @param {object} context - graphQL context.
     * @returns {Promise<Player>} the updated player.
     */
    updateCurrentPlayer: isAuthenticated(
      async (obj, { username, avatar }, { player }) => {
        // https://en.wikipedia.org/wiki/Latin_script_in_Unicode
        const sanitizedUsername =
          username
            .match(/\p{sc=Latin}|\p{Number}|\p{Emoji}|-|_/giu)
            ?.join('') ?? ''
        if (sanitizedUsername.length < 3) {
          throw new Error('Username too short')
        }
        if (await services.isUsernameUsed(sanitizedUsername, player.id)) {
          throw new Error('Username already used')
        }
        const update = { id: player.id, username: sanitizedUsername }
        if (avatar !== undefined) {
          update.avatar = avatar
        }
        const updated = await services.upsertPlayer(update)
        services.notifyRelatedPlayers(player.id)
        return updated
      }
    ),

    /**
     * Deletes an existing player account.
     * Requires authentication and elevated privileges.
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {string} args.id - deleted player's id.
     * @returns {Promise<Player|null>} deleted player account, or null.
     */
    deletePlayer: isAdmin((obj, { id }) => repositories.players.deleteById(id)),

    /**
     * Sends a friend request from one player to another one.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments, including:
     * @param {string} args.id - id of the requested player.
     * @param {object} context - graphQL context.
     * @returns {Promise<boolean>} true if the operation succeeds.
     */
    sendFriendRequest: isAuthenticated(async (obj, { id }, { player }) => {
      await services.sendFriendRequest(player, id)
      return true
    })
  }
}
