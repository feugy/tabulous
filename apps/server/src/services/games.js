import { randomUUID } from 'crypto'
import { Subject } from 'rxjs'
import { concatMap, mergeMap } from 'rxjs/operators'
import { instanciateGame } from './utils.js'

/**
 * @typedef {object} Game an active game:
 * @property {string} id - unique game id.
 * @property {string} kind - game kind (relates with game descriptor).
 * @property {number} created - game creation timestamp.
 * @property {string[]} playerId - player ids, the first always being the creator id.
 * @property {Scene} scene - the 3D engine scene, with game meshes.
 * @property {Message[]} messages - game discussion thread, if any.
 * @property {CameraPosition[]} cameras - player's saved camera positions, if any.
 */

/**
 * @typedef {object} Scene a 3D scene made of:
 * @property {Card[]} cards - a list of card meshes.
 * @property {RoundToken[]} roundTokens - a list of cylindric tokens.
 * @property {RoundedTiles[]} roundedTiles - a list of tiles with rounded corners.
 */

/**
 * @typedef {object} ImageDefs image definitions for a given mesh:
 * @property {string} front - path to its front image.
 * @property {string} back? - path to its back image, when relevant.
 */

/**
 * @typedef {object} Mesh an abstract 3D mesh:
 * @property {string} id - mesh unique id.
 * @property {string} texture - path to its texture file (one path for the entire mesh).
 * @property {ImageDefs} images - other image definitions.
 * @property {number} x? - 3D coordinate along the X axis (horizontal).
 * @property {number} z? - 3D coordinate along the Z axis (vertical).
 * @property {number} y? - 3D coordinate along the Y axis (altitude).
 * @property {boolean} isFlipped? - true means the back face is visible.
 * @property {number} angle? - rotation angle along Y axis, in radian.
 * @property {string[]} stack? - when this mesh is the origin of a stack, ordered list of other mesh ids.
 */

/**
 * @typedef {Mesh} Card a card mesh:
 * @property {number} width? - card's width (X axis).
 * @property {number} height? - card's height (Z axis).
 * @property {number} depth? - card's depth (Y axis).
 */

/**
 * @typedef {Mesh} RoundToken a round token mesh:
 * @property {number} diameter? - token's diameter (X+Z axis).
 * @property {number} height? - token's height (Y axis).
 */

/**
 * @typedef {Mesh} RoundedTiles a tile mesh with rounded corners:
 * @property {number} width? - tile's width (X axis).
 * @property {number} height? - tile's height (Z axis).
 * @property {number} depth? - tile's depth (Y axis)..
 * @property {number} borderRadius? - radius applied to each corner.
 * @property {number[]} borderColor? - Color4's components used as edge color.
 */

/**
 * @typedef {object} Message a message in the discussion thread:
 * @property {string} playerId - sender id.
 * @property {string} text - message's textual content.
 * @property {number} time - creation timestamp.
 */

/**
 * @typedef {object} CameraPosition a saved camera position
 * @property {string} playerId - owner id.
 * @property {number} index - 0-based index of this camera save.
 * @property {number[]} target - camera locked target, as an array of 3D coordinates.
 * @property {number} alpha - alpha angle, in radian.
 * @property {number} beta - beta angle, in radia.
 * @property {number} elevation - altitude, in 3D coordinate.
 */

const gamesById = new Map()
const gameListsUpdate$ = new Subject()

function isOwner(game, playerId) {
  return game && game.playerIds.includes(playerId)
}

/**
 * @typedef {object} GameListUpdate an updated list of player games.
 * @property {string} playerId - the corresponding player id.
 * @property {Game[]} games - their games.
 */

/**
 * Emits updates of game list for individual players.
 * @type {Observable<GameListUpdate[]>}
 */
export const gameListsUpdate = gameListsUpdate$.pipe(
  concatMap(n => n),
  mergeMap(playerId => listGames(playerId).then(games => ({ playerId, games })))
)

/**
 * Creates a new game of a given kind, registering the creator as a player.
 * It instanciate an unique set, based on the descriptor's bags and slots.
 * Updates the creator's game list.
 * @async
 * @param {string} root - path (JavaScript import) containing game descriptors
 * @param {string} kind - game's kind.
 * @param {string} playerId - creating player id.
 * @returns {Game} the created game.
 * @throws {Error} when no descriptor could be found for this kind.
 */
export async function createGame(root, kind, playerId) {
  try {
    const descriptor = await import(`${root}/${kind}.js`)
    const id = randomUUID()
    const created = {
      id,
      kind,
      created: Date.now(),
      playerIds: [playerId],
      scene: instanciateGame(descriptor),
      messages: [],
      cameras: []
    }
    gamesById.set(id, created)
    gameListsUpdate$.next(created.playerIds)
    return created
  } catch (err) {
    if (err?.message?.includes('Cannot find module')) {
      throw new Error(`Unsupported game ${kind}`)
    }
    throw err
  }
}

/**
 * Deletes a game for a given player.
 * The operation will abort and return null when:
 * - no game could match this game id
 * - the player does not own the game
 * Updates game lists of all related players.
 * @async
 * @param {string} gameId - loaded game id.
 * @param {string} playerId - player id.
 * @returns {Game|null} the deleted game, or null.
 */
export async function deleteGame(gameId, playerId) {
  const game = await loadGame(gameId, playerId)
  if (game) {
    gamesById.delete(gameId)
    gameListsUpdate$.next(game.playerIds)
  }
  return game
}

/**
 * Loads a game for a given player.
 * The operation will abort and return null when:
 * - no game could match this game id
 * - the player does not own the game
 * @async
 * @param {string} gameId - loaded game id.
 * @param {string} playerId - player id.
 * @returns {Game|null} the loaded game, or null.
 */
export async function loadGame(gameId, playerId) {
  const game = gamesById.get(gameId)
  if (!isOwner(game, playerId)) {
    return null
  }
  return game
}

/**
 * Saves an existing game.
 * The operation will abort and return null when:
 * - the player does not own the game
 * @async
 * @param {Game} game - saved game.
 * @param {string} playerId - owner id.
 * @returns {Game|null} the saved game, or null.
 */
export async function saveGame(game, playerId) {
  const previous = await loadGame(game?.id, playerId)
  if (previous) {
    const saved = {
      ...previous,
      scene: game.scene || previous.scene,
      messages: game.messages || previous.messages,
      cameras: game.cameras || previous.cameras
    }
    gamesById.set(game.id, saved)
    return saved
  }
  return null
}

/**
 * Invites a guest player into one of the inviting player's games.
 * The operation will abort and return null when:
 * - no game could match this game id
 * - the inviting player does not own the game
 * - the guest is already part of the game players
 * Updates game lists of all related players.
 * @async
 * @param {string} gameId - shared game id.
 * @param {string} guestId - invited player id.
 * @param {string} hostId - inviting player id.
 * @returns {Game|null} updated game, or null if the player can not be invited.
 */
export async function invite(gameId, guestId, hostId) {
  const game = await loadGame(gameId, hostId)
  if (!game || game.playerIds.includes(guestId)) {
    return null
  }
  game.playerIds.push(guestId)
  gameListsUpdate$.next(game.playerIds)
  return game
}

/**
 * Lists all games this players is in.
 * @async
 * @param {string} playerId - player id.
 * @returns {Game[]} a list of games (could be empty).
 */
export async function listGames(playerId) {
  const games = []
  for (const [, game] of gamesById) {
    if (game.playerIds.includes(playerId)) {
      games.push(game)
    }
  }
  return games
}
