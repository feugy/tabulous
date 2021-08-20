import { randomUUID } from 'crypto'
import { Subject } from 'rxjs'
import { instanciateGame } from './utils.js'

const gamesById = new Map()
const invites$ = new Subject()

function isOwner(game, playerId) {
  return game && game.playerIds.includes(playerId)
}

/**
 * @typedef {object} Invite an player invite to an existing game:
 * @property {string} gameId - shared game id.
 * @property {string} guestId - invited player id.
 * @property {string} hostId - inviting player id.
 */

/**
 * @typedef {object} Game an active game:
 * @property {string} id - unique game id.
 * @property {string} kind - game kind (relates with game descriptor).
 * @property {number} created - game creation timestamp.
 * @property {string[]} playerId - player ids, the first always being the creator id.
 * @property {Scene} scene - TODO the 3D engine scene, with game meshes.
 */

/**
 * Emits when an invite is sent, including hostId, guestId and gameId.
 * @type {Observable<Invite>}
 */
export const invites = invites$.asObservable()

/**
 * Creates a new game of a given kind, registering the creator as a player.
 * It instanciate an unique set, based on the descriptor's bags and slots.
 * @async
 * @param {string} kind - game's kind.
 * @param {string} playerId - creating player id.
 * @returns {Game} the created game.
 * @throws {Error} when no descriptor could be found for this kind.
 */
export async function createGame(kind, playerId) {
  try {
    const descriptor = await import(`../../games/${kind}.js`)
    const id = randomUUID()
    const created = {
      id,
      kind,
      created: Date.now(),
      playerIds: [playerId],
      scene: instanciateGame(descriptor)
    }
    gamesById.set(id, created)
    return created
  } catch (err) {
    if (err?.message?.includes('Cannot find module')) {
      throw new Error(`Unsupported game ${kind}`)
    }
    throw err
  }
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
  const previous = gamesById.get(game.id)
  if (!isOwner(previous, playerId)) {
    return null
  }
  const saved = { ...previous, scene: game.scene }
  gamesById.set(game.id, saved)
  return saved
}

/**
 * Invites a guest player into one of the inviting player's games.
 * The operation will abort and return null when:
 * - no game could match this game id
 * - the inviting player does not own the game
 * - the guest is already part of the game players
 * It also updates invites observable.
 * @async
 * @param {string} gameId - shared game id.
 * @param {string} guestId - invited player id.
 * @param {string} hostId - inviting player id.
 * @returns {Game|null} updated game, or null if the player can not be invited.
 */
export async function invite(gameId, guestId, hostId) {
  const game = gamesById.get(gameId)
  if (!isOwner(game, hostId) || game.playerIds.includes(guestId)) {
    return null
  }
  game.playerIds.push(guestId)
  invites$.next({ hostId, guestId, gameId })
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
