import { filter } from 'rxjs/operators'
import { isAuthenticated } from './utils.js'
import services from '../services/index.js'

export default {
  loaders: {
    Game: {
      /**
       * Loads player details of each game.
       */
      players: {
        async loader(queries) {
          return Promise.all(
            queries.map(
              ({ obj: { playerIds, players } }) =>
                players ?? services.getPlayerById(playerIds)
            )
          )
        },
        // disable cache since playing statuses are volatile
        opts: {
          cache: false
        }
      }
    }
  },

  Query: {
    /**
     * Returns details for a current player's game.
     * Requires valid authentication.
     * @async
     * @param {object} args - query arguments, including:
     * @param {string} data.gameId - game's id.
     * @returns {import('../services/games').Game|null} loaded game details, or null.
     */
    loadGame: isAuthenticated((obj, { gameId }, { player }) =>
      services.loadGame(gameId, player.id)
    )
  },

  Mutation: {
    /**
     * Instanciates a new game for the a current player (who becomes its owner).
     * Requires valid authentication.
     * @async
     * @param {object} args - query arguments, including:
     * @param {string} data.kind - created game kind.
     * @returns {import('../services/games').Game|null} created game details, or null.
     */
    createGame: isAuthenticated((obj, { kind }, { player, conf }) =>
      services.createGame(conf.games.path, kind, player.id)
    ),

    /**
     * Saves a current player's existing game details.
     * Requires valid authentication.
     * @async
     * @param {object} args - query arguments, including:
     * @param {import('./games.graphql').GameInput} data.game - partial game upte.
     * @returns {import('../services/games').Game|null} created game details, or null.
     */
    saveGame: isAuthenticated((obj, { game }, { player }) =>
      services.saveGame(game, player.id)
    ),

    /**
     * Deletes a current player's existing game.
     * Requires valid authentication.
     * @async
     * @param {object} args - query arguments, including:
     * @param {string} data.gameId - game's id.
     * @returns {import('../services/games').Game|null} deleted game details, or null.
     */
    deleteGame: isAuthenticated((obj, { gameId }, { player }) =>
      services.deleteGame(gameId, player.id)
    ),

    /**
     * Invites another player to a current player's game.
     * Requires valid authentication.
     * @async
     * @param {object} args - query arguments, including:
     * @param {string} data.gameId - game's id.
     * @param {string} data.playerId - invited player id
     * @returns {import('../services/games').Game|null} saved game details, or null.
     */
    invite: isAuthenticated((obj, { gameId, playerId }, { player }) =>
      services.invite(gameId, playerId, player.id)
    )
  },

  Subscription: {
    listGames: {
      subscribe: isAuthenticated(async (obj, args, { player, pubsub }) => {
        const topic = `listGames-${player.id}`
        const subscription = services.gameListsUpdate
          .pipe(filter(({ playerId }) => playerId === player.id))
          .subscribe(({ games }) =>
            pubsub.publish({ topic, payload: { listGames: games } })
          )

        const queue = await pubsub.subscribe(topic)
        queue.once('close', () => subscription.unsubscribe())
        services
          .listGames(player.id)
          .then(games =>
            pubsub.publish({ topic, payload: { listGames: games } })
          )
        return queue
      })
    }
  }
}
