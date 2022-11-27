import { filter } from 'rxjs/operators'

import services from '../services/index.js'
import { isAuthenticated } from './utils.js'

/** @typedef {import('../services/games').Game} Game */
/** @typedef {import('../services/games').GameParameters} GameParameters */

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
                players.map(player => ({
                  ...player,
                  isGuest: obj.guestIds.includes(player.id),
                  isOwner: obj.ownerId === player.id
                }))
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
    /**
     * Returns the list of current games.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - subscription arguments.
     * @param {object} context - graphQL context.
     * @returns {Promise<Game[]>} list of current games.
     */
    listGames: isAuthenticated(async (obj, args, { player }) =>
      services.listGames(player.id)
    )
  },

  Mutation: {
    /**
     * Instanciates a new game for the a current player (who becomes its owner).
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {string} args.kind - created game kind.
     * @param {object} context - graphQL context.
     * @returns {Promise<String|null>} created game details, or null.
     */
    createGame: isAuthenticated((obj, { kind }, { player }) =>
      services.createGame(kind, player)
    ),

    /**
     * Joins a game, potentially with parameters (for guests).
     * May returns other parameters if provided values disn't suffice, or the actual game content.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {string} args.gameId - game's id.
     * @param {string} args.parameters - player's provided parameters
     * @param {object} context - graphQL context.
     * @returns {Promise<Game|GameParameters|null>} joined game in case of success, new required parameters, or null.
     */
    joinGame: isAuthenticated(
      (obj, { gameId, parameters: paramString }, { player }) => {
        let parameters = null
        if (paramString) {
          try {
            parameters = JSON.parse(paramString)
          } catch (err) {
            throw new Error(
              `Failed to parse provided parameters: ${err.message}`
            )
          }
        }
        return services.joinGame(gameId, player, parameters)
      }
    ),

    /**
     * Saves a current player's existing game details.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {import('./games.graphql').GameInput} args.game - partial game update.
     * @param {object} context - graphQL context.
     * @returns {Promise<Game|null>} created game details, or null.
     */
    saveGame: isAuthenticated((obj, { game }, { player }) =>
      services.saveGame(game, player.id)
    ),

    /**
     * Deletes a current player's existing game.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {string} args.gameId - game's id.
     * @param {object} context - graphQL context.
     * @returns {Promise<Game|null>} deleted game details, or null.
     */
    deleteGame: isAuthenticated((obj, { gameId }, { player }) =>
      services.deleteGame(gameId, player.id)
    ),

    /**
     * Invites another player to a current player's game.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {string} args.gameId - game's id.
     * @param {string} args.playerId - guest player id
     * @param {object} context - graphQL context.
     * @returns {Promise<Game|null>} saved game details, or null.
     */
    invite: isAuthenticated((obj, { gameId, playerId: guestId }, { player }) =>
      services.invite(gameId, guestId, player.id)
    )
  },

  Subscription: {
    /**
     * Sends the full list of current games to a given player when they change.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - subscription arguments.
     * @param {object} context - graphQL context.
     */
    receiveGameListUpdates: {
      subscribe: isAuthenticated(async (obj, args, { player, pubsub }) => {
        const topic = `listGames-${player.id}`
        const subscription = services.gameListsUpdate
          .pipe(filter(({ playerId }) => playerId === player.id))
          .subscribe(({ games }) =>
            pubsub.publish({
              topic,
              payload: { receiveGameListUpdates: games }
            })
          )

        const queue = await pubsub.subscribe(topic)
        queue.once('close', () => subscription.unsubscribe())
        return queue
      })
    },
    receiveGameUpdates: {
      /**
       * Sends a given game updates from server.
       * Requires valid authentication, and users must have this game in their list.
       * @param {object} obj - graphQL object.
       * @param {object} args - subscription arguments, including:
       * @param {string} args.gameId - game's id.
       * @param {object} context - graphQL context.
       */
      subscribe: isAuthenticated(
        async (obj, { gameId }, { player, pubsub }) => {
          const topic = `receiveGameUpdates-${player.id}-${gameId}`
          const subscription = services.gameListsUpdate
            .pipe(filter(({ playerId }) => playerId === player.id))
            .subscribe(({ games }) => {
              const game = games.find(({ id }) => id === gameId)
              pubsub.publish({ topic, payload: { receiveGameUpdates: game } })
            })
          const queue = await pubsub.subscribe(topic)
          queue.once('close', () => subscription.unsubscribe())
          return queue
        }
      )
    }
  },

  GameOrParameters: {
    // distinguishes returned Game from GameParameters
    resolveType(obj) {
      return obj?.schema ? 'GameParameters' : 'Game'
    }
  },

  GameParameters: {
    schemaString: obj => JSON.stringify(obj.schema)
  }
}
