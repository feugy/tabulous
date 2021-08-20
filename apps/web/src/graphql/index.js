import {
  createGame,
  deleteGame,
  invite,
  listGames,
  loadGame,
  loadGamePlayers,
  saveGame
} from './games.graphql'
import { logIn } from './players.graphql'

// jest transformers don't allow export all from graphql files
export {
  createGame,
  deleteGame,
  invite,
  listGames,
  loadGame,
  loadGamePlayers,
  saveGame,
  logIn
}
