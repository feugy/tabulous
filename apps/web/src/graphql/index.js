import {
  createGame,
  deleteGame,
  invite,
  listGames,
  loadGame,
  loadGamePlayers,
  saveGame
} from './games.graphql'
import { getCurrentPlayer, logIn, searchPlayers } from './players.graphql'
import { sendSignal, awaitSignal } from './signals.graphql'

// jest transformers don't allow export all from graphql files
export {
  awaitSignal,
  createGame,
  deleteGame,
  getCurrentPlayer,
  invite,
  listGames,
  loadGame,
  loadGamePlayers,
  logIn,
  saveGame,
  searchPlayers,
  sendSignal
}
