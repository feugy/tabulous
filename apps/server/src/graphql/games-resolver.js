import {
  createGame,
  invite,
  listGames,
  loadGame,
  saveGame
} from '../services/index.js'
import { isAuthenticated } from './utils.js'

export default {
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
