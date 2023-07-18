// @ts-check
import { filter } from 'rxjs/operators'

import services from '../services/index.js'
import { makeLogger } from '../utils/index.js'
import { isAuthenticated } from './utils.js'

const logger = makeLogger('games-resolver')

/** @typedef {import('./utils.js').GraphQLContext} GraphQLContext */
/** @typedef {import('../services/players.js').Player} Player */
/** @typedef {import('../services/games').Game} Game */
/** @typedef {import('../services/games').GameData} GameData */
/** @typedef {import('../services/games').GameParameters} GameParameters */

/**
 * Scafolds Mercurius loaders for specific properties of queried objects.
 * These loaders will fill populate a game's players field from its playerIds and guestIds array.
 * @returns {{ loader: import('mercurius').Loader<any, any, GraphQLContext>, opts: { cache: boolean } }} built loaders
 */
function buildPlayerLoader() {
  return {
    async loader(queries) {
      return Promise.all(
        queries.map(
          ({ obj }) =>
            obj.players ??
            services
              .getPlayerById([...obj.playerIds, ...obj.guestIds])
              .then(players =>
                /** @type {Player[]} */ (players.filter(Boolean)).map(
                  player => ({
                    ...player,
                    isGuest: obj.guestIds.includes(player.id),
                    isOwner: obj.ownerId === player.id
                  })
                )
              )
        )
      )
    },
    // disable cache since playing statuses are volatile
    opts: { cache: false }
  }
}

export default {
  loaders: {
    /**
     * Loads player and guest details on the fly.
     */
    Game: {
      players: buildPlayerLoader()
    },
    GameParameters: {
      players: buildPlayerLoader()
    }
  },

  Query: {
    /** @typedef {ReturnType<typeof services.listGames>} ListGameResponse */
    listGames: isAuthenticated(
      /**
       * Returns the list of current games.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {unknown} args - subscription arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {ListGameResponse} list of current games.
       */
      (obj, args, { player }) => services.listGames(player.id)
    )
  },

  Mutation: {
    /**
     * @typedef {object} CreateGameArgs
     * @property {string} kind - created game kind.
     */
    /** @typedef {ReturnType<typeof services.createGame>} CreateGameResponse */
    createGame: isAuthenticated(
      /**
       * Instanciates a new game for the a current player (who becomes its owner).
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {CreateGameArgs} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {CreateGameResponse} created game details, or null.
       */
      (obj, { kind }, { player }) => services.createGame(kind, player)
    ),

    /**
     * @typedef {object} JoinGameArgs
     * @property {string} gameId - joined game's id.
     * @property {string} parameters - player's provided parameters in a stringified object.
     */
    /** @typedef {ReturnType<typeof services.joinGame>} JoinGameResponse */
    joinGame: isAuthenticated(
      /**
       * Joins a game, potentially with parameters (for guests).
       * May returns other parameters if provided values disn't suffice, or the actual game content.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {JoinGameArgs} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {JoinGameResponse} joined game in case of success, new required parameters, or null.
       */
      (obj, { gameId, parameters: paramString }, { player }) => {
        let parameters = null
        if (paramString) {
          try {
            parameters = JSON.parse(paramString)
          } catch (err) {
            throw new Error(
              `Failed to parse provided parameters: ${
                /** @type {Error} */ (err).message
              }`
            )
          }
        }
        return services.joinGame(gameId, player, parameters)
      }
    ),

    /**
     * @typedef {object} PromoteGameArgs
     * @property {string} gameId - promoted game's id.
     * @property {string} kind - promoted game kind.
     */
    /** @typedef {ReturnType<typeof services.promoteGame>} PromoteGameResponse */
    promoteGame: isAuthenticated(
      /**
       * Promote a lobby into a full game, setting its kind.
       * May returns parameters if needed, or the actual game content.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {PromoteGameArgs} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {PromoteGameResponse} joined game in case of success, new required parameters, or null.
       */
      (obj, { gameId, kind }, { player }) =>
        services.promoteGame(gameId, kind, player)
    ),

    /**
     * @typedef {object} SaveGameArgs
     * @property {Partial<GameData>} game - saved game data
     */
    /** @typedef {ReturnType<typeof services.saveGame>} SaveGameResponse */
    saveGame: isAuthenticated(
      /**
       * Saves a current player's existing game details.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {SaveGameArgs} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {SaveGameResponse} created game details, or null.
       */
      (obj, { game }, { player }) => services.saveGame(game, player.id)
    ),

    /**
     * @typedef {object} DeleteGameArgs
     * @property {string} gameId - deleted game's id.
     */
    /** @typedef {ReturnType<typeof services.saveGame>} DeleteGameResponse */
    deleteGame: isAuthenticated(
      /**
       * Deletes a current player's existing game.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {DeleteGameArgs} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {DeleteGameResponse} deleted game details, or null.
       */
      (obj, { gameId }, { player }) => services.deleteGame(gameId, player)
    ),

    /**
     * @typedef {object} InviteArgs
     * @property {string} gameId - game's id.
     * @property {string[]} playerIds - invited player ids.
     */
    /** @typedef {ReturnType<typeof services.invite>} InviteResponse */
    invite: isAuthenticated(
      /**
       * Invites another player to a current player's game.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {InviteArgs} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {InviteResponse} saved game details, or null.
       */
      (obj, { gameId, playerIds: guestIds }, { player }) =>
        services.invite(gameId, guestIds, player.id)
    ),

    /**
     * @typedef {object} KickArgs
     * @property {string} gameId - game's id.
     * @property {string} playerId - kicked player id.
     */
    /** @typedef {ReturnType<typeof services.kick>} KickResponse */
    kick: isAuthenticated(
      /**
       * Kick a player from a current player's game.
       * Requires valid authentication.
       * @param {unknown} obj - graphQL object.
       * @param {KickArgs} args - mutation arguments.
       * @param {GraphQLContext} context - graphQL context.
       * @returns {KickResponse} saved game details, or null.
       */
      (obj, { gameId, playerId: kickedId }, { player }) =>
        services.kick(gameId, kickedId, player.id)
    )
  },

  Subscription: {
    receiveGameListUpdates: {
      subscribe: isAuthenticated(
        /**
         * Sends the full list of current games to a given player when they change.
         * Requires valid authentication.
         * @param {unknown} obj - graphQL object.
         * @param {unknown} args - subscription arguments.
         * @param {GraphQLContext} context - graphQL context.
         * @yields {Game[]}
         * @returns {import('./utils.js').PubSubQueue}
         */
        async (obj, args, { player, pubsub }) => {
          const topic = `listGames-${player.id}`
          const subscription = services.gameListsUpdate
            .pipe(filter(({ playerId }) => playerId === player.id))
            .subscribe(({ games }) => {
              pubsub.publish({
                topic,
                payload: { receiveGameListUpdates: games }
              })
              logger.debug(
                { res: { topic, games: games.length } },
                'sent game list update'
              )
            })

          const queue = await pubsub.subscribe(topic)
          queue.once('close', () => subscription.unsubscribe())
          logger.debug({ ctx: { topic } }, 'subscribed to game list updates')
          return queue
        }
      )
    },

    /**
     * @typedef {object} ReceiveGameUpdatesArgs
     * @property {string} gameId - game's id.
     */
    receiveGameUpdates: {
      subscribe: isAuthenticated(
        /**
         * Sends a given game updates from server.
         * Requires valid authentication, and users must have this game in their list.
         * @param {unknown} obj - graphQL object.
         * @param {ReceiveGameUpdatesArgs} args - subscription argument.
         * @param {GraphQLContext} context - graphQL context.
         * @yields {Game}
         * @returns {import('./utils.js').PubSubQueue}
         */
        async (obj, { gameId }, { player, pubsub }) => {
          const topic = `receiveGameUpdates-${player.id}-${gameId}`
          const subscription = services.gameListsUpdate
            .pipe(filter(({ playerId }) => playerId === player.id))
            .subscribe(({ games }) => {
              const game = games.find(({ id }) => id === gameId)
              if (game) {
                pubsub.publish({ topic, payload: { receiveGameUpdates: game } })
                logger.debug(
                  { res: { topic, game: { id: game.id, kind: game.kind } } },
                  'sent single game update'
                )
              }
            })
          const queue = await pubsub.subscribe(topic)
          queue.once('close', () => subscription.unsubscribe())
          logger.debug({ ctx: { topic } }, 'subscribed to single game updates')
          return queue
        }
      )
    }
  },

  GameOrParameters: {
    /**
     * Distinguishes returned Game from GameParameters
     * @param {?GameData|GameParameters} obj - either a Game or a GameParameters object
     * @returns {string} the type of this object.
     */
    resolveType(obj) {
      return obj && 'schema' in obj ? 'GameParameters' : 'Game'
    }
  },

  GameParameters: {
    /**
     * Serializer for schema.
     * @param {GameParameters} obj - serialized game parameter schema
     * @returns {string}
     */
    schemaString: obj => JSON.stringify(obj.schema)
  }
}
