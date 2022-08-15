import { listCatalog } from './catalog.graphql'
import {
  createGame,
  deleteGame,
  getGamePlayers,
  invite,
  listGames,
  loadGame,
  receiveGameUpdates,
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
  getGamePlayers,
  invite,
  listCatalog,
  listGames,
  loadGame,
  logIn,
  receiveGameUpdates,
  saveGame,
  searchPlayers,
  sendSignal
}
