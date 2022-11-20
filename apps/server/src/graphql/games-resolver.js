import { filter } from 'rxjs/operators'

import services from '../services/index.js'
import { isAuthenticated } from './utils.js'

export default {
  loaders: {
    /**
     * Loads player and guest details on the fly.
     * Disable cache since playing statuses are volatile
     */
    Game: {
      players: {
        async loader(queries) {
          return Promise.all(
            queries.map(
              ({ obj: { playerIds, players } }) =>
                players ?? services.getPlayerById(playerIds)
            )
          )
        },
        opts: { cache: false }
      },
      guests: {
        async loader(queries) {
          return Promise.all(
            queries.map(
              ({ obj: { guestIds, guests } }) =>
                guests ?? services.getPlayerById(guestIds)
            )
          )
        },
        opts: { cache: false }
      }
    }
  },

  Query: {
    /**
     * Returns the list of current games.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - subscription arguments.
     * @param {object} context - graphQL context.
     * @returns {Promise<import('../services/games').Game[]>} list of current games.
     */
    listGames: isAuthenticated(async (obj, args, { player }) =>
      services.listGames(player.id)
    ),

    /**
     * Returns details for a current player's game.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - query arguments, including:
     * @param {string} args.gameId - game's id.
     * @param {object} context - graphQL context.
     * @returns {Promise<import('../services/games').Game|null>} loaded game details, or null.
     */
    loadGame: isAuthenticated((obj, { gameId }, { player }) =>
      services.loadGame(gameId, player.id)
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
     * @returns {Promise<import('../services/games').Game|null>} created game details, or null.
     */
    createGame: isAuthenticated((obj, { kind }, { player }) =>
      services.createGame(kind, player.id)
    ),

    /**
     * Saves a current player's existing game details.
     * Requires valid authentication.
     * @param {object} obj - graphQL object.
     * @param {object} args - mutation arguments, including:
     * @param {import('./games.graphql').GameInput} args.game - partial game update.
     * @param {object} context - graphQL context.
     * @returns {Promise<import('../services/games').Game|null>} created game details, or null.
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
     * @returns {Promise<import('../services/games').Game|null>} deleted game details, or null.
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
     * @param {string} args.playerId - invited player id
     * @param {object} context - graphQL context.
     * @returns {Promise<import('../services/games').Game|null>} saved game details, or null.
     */
    invite: isAuthenticated((obj, { gameId, playerId }, { player }) =>
      services.invite(gameId, playerId, player.id)
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
  }
}
