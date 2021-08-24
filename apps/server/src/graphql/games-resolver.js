import {
  createGame,
  deleteGame,
  invite,
  gameListsUpdate,
  getPlayersById,
  loadGame,
  saveGame,
  listGames
} from '../services/index.js'
import { isAuthenticated } from './utils.js'

let listGamesSubscription

export default {
  loaders: {
    Game: {
      players: {
        async loader(queries) {
          return Promise.all(
            queries.map(
              ({ obj: { playerIds, players } }) =>
                players ?? getPlayersById(playerIds)
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
    loadGame: isAuthenticated((obj, { gameId }, { player }) =>
      loadGame(gameId, player.id)
    )
  },

  Mutation: {
    createGame: isAuthenticated((obj, { kind }, { player }) =>
      createGame(kind, player.id)
    ),
    saveGame: isAuthenticated((obj, { game }, { player }) =>
      saveGame(game, player.id)
    ),
    deleteGame: isAuthenticated((obj, { gameId }, { player }) =>
      deleteGame(gameId, player.id)
    ),
    invite: isAuthenticated((obj, { gameId, playerId }, { player }) =>
      invite(gameId, playerId, player.id)
    )
  },

  Subscription: {
    listGames: {
      subscribe: isAuthenticated((obj, args, { pubsub, player }) => {
        if (!listGamesSubscription) {
          // TODO no way to clean it up...
          listGamesSubscription = gameListsUpdate.subscribe(
            ({ playerId, games }) =>
              pubsub.publish({
                topic: `listGames-${playerId}`,
                payload: { listGames: games }
              })
          )
        }

        const topic = `listGames-${player.id}`
        const subscription = pubsub.subscribe(topic)
        listGames(player.id).then(games =>
          pubsub.publish({ topic, payload: { listGames: games } })
        )
        return subscription
      })
    }
  }
}
