// @ts-check
import { filter } from 'rxjs'

import { makeToken } from '../plugins/utils.js'
import * as repositories from '../repositories/index.js'
import services from '../services/index.js'
import { hash, makeLogger } from '../utils/index.js'
import { isAdmin, isAuthenticated } from './utils.js'

const logger = makeLogger('players-resolver')

/**
 * Scafolds Mercurius loaders for specific properties of queried objects.
 * These loaders will fill the field property value with player models which ids are in idField property value.
 * The loader only resolve once, and do not fetched once the models are available.
 * @param {string} field - field name for which the loader is defined.
 * @param {string} idField - field storing the resolved id.
 * @returns built loaders
 */
function buildPlayerLoader(field, idField) {
  return {
    /** @type {import('mercurius').Loader<any, any, import('./utils').GraphQLContext>}*/
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
       * @param {import('./utils').GraphQLContext} context - graphQL context.
       * @returns current player with turn credentials.
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

    searchPlayers: isAuthenticated(
      /**
       * Returns players (except the current one) which username contains searched text.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {import('.').SearchPlayersArgs} args - query arguments.
       * @param {import('./utils').GraphQLContext} context - graphQL context.
       * @returns list (potentially empty) of matching players.
       */
      (obj, { search, includeCurrent }, { player }) =>
        services.searchPlayers(search, player.id, !includeCurrent)
    ),

    listPlayers: isAdmin(
      /**
       * Returns a page or players.
       * Requires authentication and elevated privileges.
       * @param {unknown} obj - graphQL object.
       * @param {import('.').ListPlayersArgs} args - query arguments, including:
       * @returns extract of the player list.
       */
      (obj, args) => repositories.players.list(args)
    ),

    listFriends: isAuthenticated(
      /**
       * Returns the list of friends of a given player.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {unknown} args - query arguments.
       * @param {import('./utils').GraphQLContext} context - graphQL context.
       * @returns list (potentially empty) of friend players.
       */
      (obj, args, { player }) => services.listFriends(player.id)
    )
  },

  Mutation: {
    addPlayer: isAdmin(
      /**
       * Create a new player account that can connect with a password value.
       * The clear password provided is hashed before being stored.
       * Requires authentication and elevated privileges.
       * @param {unknown} obj - graphQL object.
       * @param {import('.').AddPlayerArgs} args - mutation arguments.
       * @returns the created player.
       */
      async (obj, { id, username, password }) =>
        services.upsertPlayer({ id, username, password: hash(password) })
    ),

    /**
     * Authenticates an user from their user id.
     * Returns a token to allow browser issueing authenticated requests.
     * @param {unknown} obj - graphQL object.
     * @param {import('.').LogInArgs} args - mutation arguments.
     * @param {import('./utils').GraphQLContext} context - graphQL context.
     * @returns authentified player with turn credentials.
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

    acceptTerms: isAuthenticated(
      /**
       * Record an user accepting the terms of service.
       * @param {unknown} obj - graphQL object.
       * @param {unknown} args - mutation arguments.
       * @param {import('./utils').GraphQLContext} context - graphQL context.
       * @returns saved player.
       */
      (obj, args, { player }) => services.acceptTerms(player)
    ),

    updateCurrentPlayer: isAuthenticated(
      /**
       * Updates current player's details.
       * Requires authentication.
       * @param {unknown} obj - graphQL object.
       * @param {import('.').UpdateCurrentPlayerArgs} args - mutation arguments.
       * @param {import('./utils').GraphQLContext} context - graphQL context.
       * @returns the updated player.
       */
      async (obj, { username, avatar, usernameSearchable }, { player }) => {
        logger.trace('updates current player')
        /** @type {Partial<import('@tabulous/types').Player>} */
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

    deletePlayer: isAdmin(
      /**
       * Deletes an existing player account.
       * Requires authentication and elevated privileges.
       * @param {unknown} obj - graphQL object.
       * @param {import('.').TargetedPlayerArgs} args - mutation arguments.
       * @returns deleted player account, or null.
       */
      (obj, { id }) => repositories.players.deleteById(id)
    ),

    requestFriendship: isAuthenticated(
      /**
       * Sends a friend request from one player to another one.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {import('.').TargetedPlayerArgs} args - mutation arguments.
       * @param {import('./utils').GraphQLContext} context - graphQL context.
       * @returns true if the operation succeeds.
       */
      (obj, { id }, { player }) => services.requestFriendship(player, id)
    ),

    acceptFriendship: isAuthenticated(
      /**
       * Accepts a friend request from another player.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {import('.').TargetedPlayerArgs} args - mutation arguments.
       * @param {import('./utils').GraphQLContext} context - graphQL context.
       * @returns true if the operation succeeds.
       */
      (obj, { id }, { player }) => services.acceptFriendship(player, id)
    ),

    endFriendship: isAuthenticated(
      /**
       * Declines a friend request or ends existing friendship with another player.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {import('.').TargetedPlayerArgs} args - mutation arguments.
       * @param {import('./utils').GraphQLContext} context - graphQL context.
       * @returns true if the operation succeeds.
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
         * @param {import('./utils').GraphQLContext} context - graphQL context.
         * @yields {import('.').FriendshipUpdate}
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
