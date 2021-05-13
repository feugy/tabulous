import {
  createGame,
  invite,
  listGames,
  loadGame,
  saveGame
} from './games.graphql'
import { logIn } from './players.graphql'

// jest transformers don't allow export all from graphql files
export { createGame, invite, listGames, loadGame, saveGame, logIn }
