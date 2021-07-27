import {
  createGame,
  invite,
  getPlayersById,
  listGames,
  loadGame,
  saveGame
} from '../services/index.js'
import { isAuthenticated } from './utils.js'

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
    loadGame: isAuthenticated(async (obj, { gameId }, { player }) =>
      loadGame(gameId, player.id)
    ),
    listGames: isAuthenticated(async (obj, args, { player }) =>
      listGames(player.id)
    )
  },

  Mutation: {
    createGame: isAuthenticated(async (obj, { kind }, { player }) =>
      createGame(kind, player.id)
    ),
    saveGame: isAuthenticated(async (obj, { game }, { player }) =>
      saveGame(game, player.id)
    ),
    invite: isAuthenticated(async (obj, { gameId, playerId }, { player }) =>
      invite(gameId, playerId, player.id)
    )
  }
}
