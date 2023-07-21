// @ts-check
import { filter } from 'rxjs'

import { makeToken } from '../plugins/utils.js'
import repositories from '../repositories/index.js'
import services from '../services/index.js'
import { hash, makeLogger } from '../utils/index.js'
import { isAdmin, isAuthenticated } from './utils.js'

const logger = makeLogger('players-resolver')

/** @typedef {import('./utils.js').GraphQLContext} GraphQLContext */
/** @typedef {import('../services/players.js').Player} Player */

/**
 * @typedef {object} PlayerWithTurnCredentials
 * @property {string} token - authentication token.
 * @property {Player} player - authenticated player.
 * @property {import('../services/turn-credentials.js').TurnCredentials} turnCredentials - credentials for the TURN server.
 */

/**
 * Scafolds Mercurius loaders for specific properties of queried objects.
 * These loaders will fill the field property value with player models which ids are in idField property value.
 * The loader only resolve once, and do not fetched once the models are available.
 * @param {string} field - field name for which the loader is defined.
 * @param {string} idField - field storing the resolved id.
 * @returns {{ loader: import('mercurius').Loader<any, any, GraphQLContext>, opts: { cache: boolean } }} built loaders
 */
function buildPlayerLoader(field, idField) {
  return {
    async loader(queries) {
      const ids = queries.reduce(
        (/** @type {string[]} */ ids, { obj }) =>
          obj[field] ? ids : [obj[idField], ...ids],
        []
      )
      const players = ids.length ? await services.getPlayerById(ids) : []
      return queries.map(
        ({ obj }) =>
          obj[field] ?? players.find(player => player?.id === obj[idField])
      )
    },
    // disable cache since playing statuses are volatile
    opts: { cache: false }
  }
}

export default {
  loaders: {
    Friendship: {
      /**
       * Loads player details on the fly.
       */
      player: buildPlayerLoader('player', 'playerId')
    },
    FriendshipUpdate: {
      /**
       * Loads player details on the fly.
       */
      from: buildPlayerLoader('from', 'id')
    }
  },

  Query: {
    getCurrentPlayer: isAuthenticated(
      /**
       * Returns the current player data from their authentication details.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {unknown} args - query arguments:
       * @param {GraphQLContext} context - graphQL context.
       * @returns {PlayerWithTurnCredentials} current player with turn credentials.
       */
      (obj, args, { player, conf, token }) => {
        logger.trace(
          { ctx: { playerId: player.id } },
          'generates turn credentials for current player'
        )
        const turnCredentials = services.generateTurnCredentials(
          conf.turn.secret
        )
        return { token, player, turnCredentials }
      }
    ),

    /**
     * @typedef {object} SearchPlayersArgs
     * @property {string} search - searched text.
     * @property {boolean} includeCurrent - whether to include current player in results or not.
     */
    /** @typedef {ReturnType<typeof services.searchPlayers>} SearchPlayersResponse */
    searchPlayers: isAuthenticated(
      /**
       * Returns players (except the current one) which username contains searched text.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {SearchPlayersArgs} args - query arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {SearchPlayersResponse} list (potentially empty) of matching players.
       */
      (obj, { search, includeCurrent }, { player }) =>
        services.searchPlayers(search, player.id, !includeCurrent)
    ),

    /**
     * @typedef {object} ListPlayersArgs
     * @property {number} from - index of the first result returned.
     * @property {number} size - number of return results.
     */
    /** @typedef {ReturnType<typeof repositories.players.list>} ListPlayersResponse */
    listPlayers: isAdmin(
      /**
       * Returns a page or players.
       * Requires authentication and elevated privileges.
       * @param {unknown} obj - graphQL object.
       * @param {ListPlayersArgs} args - query arguments, including:
       * @returns {ListPlayersResponse} extract of the player list.
       */
      (obj, args) => repositories.players.list(args)
    ),

    /** @typedef {ReturnType<typeof services.listFriends>} ListFriendsResponse */
    listFriends: isAuthenticated(
      /**
       * Returns the list of friends of a given player.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {unknown} args - query arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {ListFriendsResponse} list (potentially empty) of friend players.
       */
      (obj, args, { player }) => services.listFriends(player.id)
    )
  },

  Mutation: {
    /**
     * @typedef {object} AddPlayerArgs
     * @property {string} id - created player id.
     * @property {string} username - created player username.
     * @property {string} password - created player password (clear value).
     */
    /** @typedef {ReturnType<typeof services.upsertPlayer>} AddPlayerResponse */
    addPlayer: isAdmin(
      /**
       * Create a new player account that can connect with a password value.
       * The clear password provided is hashed before being stored.
       * Requires authentication and elevated privileges.
       * @param {unknown} obj - graphQL object.
       * @param {AddPlayerArgs} args - mutation arguments.
       * @returns {AddPlayerResponse} the created player.
       */
      async (obj, { id, username, password }) =>
        services.upsertPlayer({ id, username, password: hash(password) })
    ),

    /**
     * @typedef {object} LogInArgs
     * @property {string} id - user account id.
     * @property {string} password - clear password.
     */

    /**
     * Authenticates an user from their user id.
     * Returns a token to allow browser issueing authenticated requests.
     * @param {unknown} obj - graphQL object.
     * @param {LogInArgs} args - mutation arguments.
     * @param {GraphQLContext} context - graphQL context.
     * @returns {Promise<PlayerWithTurnCredentials>} authentified player with turn credentials.
     */
    logIn: async (obj, { id, password }, { conf }) => {
      logger.trace('authenticates manual player')
      const player = await services.getPlayerById(id)
      if (!player || !player.password || hash(password) !== player.password) {
        throw new Error('forbidden')
      }
      const turnCredentials = services.generateTurnCredentials(conf.turn.secret)
      const token = makeToken(player, conf.auth.jwt)
      logger.debug(
        { res: { id, username: player.username } },
        'authenticated manual player'
      )
      return { token, player, turnCredentials }
    },

    /** @typedef {ReturnType<typeof services.acceptTerms>} AcceptTermsResponse */
    acceptTerms: isAuthenticated(
      /**
       * Record an user accepting the terms of service.
       * @param {unknown} obj - graphQL object.
       * @param {unknown} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {AcceptTermsResponse} saved player.
       */
      (obj, args, { player }) => services.acceptTerms(player)
    ),

    /**
     * @typedef {object} UpdateCurrentPlayerArgs
     * @property {string} [username] - new username value, if any.
     * @property {string} [avatar] - new avatar value, if any.
     * @property {boolean} [usernameSearchable] - new value for username searchability, if any.
     */
    /** @typedef {Promise<Player>} UpdateCurrentPlayerResponse */
    updateCurrentPlayer: isAuthenticated(
      /**
       * Updates current player's details.
       * Requires authentication.
       * @param {unknown} obj - graphQL object.
       * @param {UpdateCurrentPlayerArgs} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {UpdateCurrentPlayerResponse} the updated player.
       */
      async (obj, { username, avatar, usernameSearchable }, { player }) => {
        logger.trace('updates current player')
        /** @type {Partial<Player>} */
        const update = { id: player.id }
        if (username !== undefined) {
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
          update.username = sanitizedUsername
        }
        if (avatar !== undefined) {
          update.avatar = avatar
        }
        if (usernameSearchable !== undefined) {
          update.usernameSearchable = usernameSearchable
        }
        const updated = await services.upsertPlayer(update)
        services.notifyRelatedPlayers(player.id)
        logger.debug('updated current player')
        return updated
      }
    ),

    /**
     * @typedef {object} TargetedPlayerArgs
     * @property {string} id - id of the targeted player.
     */
    /** @typedef {Promise<?Player>} DeletePlayerResponse */
    deletePlayer: isAdmin(
      /**
       * Deletes an existing player account.
       * Requires authentication and elevated privileges.
       * @param {unknown} obj - graphQL object.
       * @param {TargetedPlayerArgs} args - mutation arguments.
       * @returns {DeletePlayerResponse} deleted player account, or null.
       */
      (obj, { id }) => repositories.players.deleteById(id)
    ),

    /** @typedef {ReturnType<typeof services.requestFriendship>} RequestFriendshipResponse */
    requestFriendship: isAuthenticated(
      /**
       * Sends a friend request from one player to another one.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {TargetedPlayerArgs} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {RequestFriendshipResponse} true if the operation succeeds.
       */
      (obj, { id }, { player }) => services.requestFriendship(player, id)
    ),

    /** @typedef {ReturnType<typeof services.acceptFriendship>} AcceptFriendshipResponse */
    acceptFriendship: isAuthenticated(
      /**
       * Accepts a friend request from another player.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {TargetedPlayerArgs} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {AcceptFriendshipResponse} true if the operation succeeds.
       */
      (obj, { id }, { player }) => services.acceptFriendship(player, id)
    ),

    /** @typedef {ReturnType<typeof services.endFriendship>} EndFriendshipResponse */
    endFriendship: isAuthenticated(
      /**
       * Declines a friend request or ends existing friendship with another player.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {TargetedPlayerArgs} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {EndFriendshipResponse} true if the operation succeeds.
       */
      (obj, { id }, { player }) => services.endFriendship(player, id)
    )
  },

  Subscription: {
    receiveFriendshipUpdates: {
      subscribe: isAuthenticated(
        /**
         * Sends updates (new request, acceptation and declines) to the a given player's friend list.
         * Requires valid authentication.
         * @param {unknown} obj - graphQL object.
         * @param {object} args - subscription arguments.
         * @param {GraphQLContext} context - graphQL context.
         * @yields {Omit<import('../services/player.js').FriendshipUpdate, 'from'> & { id: string }}
         * @returns {import('./utils.js').PubSubQueue}
         */
        async (obj, args, { player, pubsub }) => {
          const topic = `friendship-${player.id}`
          const subscription = services.friendshipUpdates
            .pipe(filter(({ to }) => to === player.id))
            .subscribe(({ from, ...others }) => {
              pubsub.publish({
                topic,
                payload: { receiveFriendshipUpdates: { id: from, ...others } }
              })
              logger.debug(
                { res: { topic, from, ...others } },
                'sent friendship update'
              )
            })
          const queue = await pubsub.subscribe(topic)
          queue.once('close', () => subscription.unsubscribe())
          logger.debug({ ctx: { topic } }, 'subscribed to friendship updates')
          return queue
        }
      )
    }
  }
}
