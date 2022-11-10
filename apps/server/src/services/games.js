import { concatMap, mergeMap, Subject } from 'rxjs'

import repositories from '../repositories/index.js'
import { createMeshes, pickRandom } from '../utils/index.js'
import { canAccess } from './catalog.js'

/**
 * @typedef {object} Game an active game:
 * @property {string} id - unique game id.
 * @property {string} kind - game kind (relates with game descriptor).
 * @property {number} created - game creation timestamp.
 * @property {string[]} playerId - player ids, the first always being the creator id.
 * @property {Mesh[]} meshes - game meshes.
 * @property {Message[]} messages - game discussion thread, if any.
 * @property {CameraPosition[]} cameras - player's saved camera positions, if any.
 * @property {Hand[]} hands - player's private hands, id any.
 * @property {number} rulesBookPageCount? - number of pages in the rules book, if any.
 * @property {ZoomSpec} zoomSpec? - zoom specifications for main and hand scene.
 */

/**
 * @typedef {object} Mesh a 3D mesh, with a given shape. Some of its attribute are shape-specific:
 * @property {string} shape - the mesh shape: card, roundToken or roundedTile.
 * @property {string} id - mesh unique id.
 * @property {string} texture - path to its texture file (one path for the entire mesh).
 * @property {number[][]} faceUV - list of face UV (Vector4 components), to map texture on the mesh (depends on its shape).
 * @property {number} x? - 3D coordinate along the X axis (horizontal).
 * @property {number} z? - 3D coordinate along the Z axis (vertical).
 * @property {number} y? - 3D coordinate along the Y axis (altitude).
 * @property {number} width? - mesh's width (X axis).
 * @property {number} height? - mesh's height (Y axis), for card and rounded tiles.
 * @property {number} depth? - mesh's depth (Z axis), for card and rounded tiles.
 * @property {number} diameter? - mesh's diameter (X+Z axis), for round tokens.
 * @property {number} borderRadius? - cordener radius, for rounded tiles.
 * @property {DetailableState} detailable? - if this mesh could be detailed, contains details.
 * @property {MovableState} movable? - if this mesh could be moved, contains move state.
 * @property {FlippableState} flippable? - if this mesh could be flipped, contains flip state.
 * @property {RotableState} rotable? - if this mesh could be rotated along Y axis, contains rotation state.
 * @property {AnchorableState} anchorable? - if this mesh has anchors, contains their state.
 * @property {StackableState} stackable? - if this mesh could be stack under others, contains stack state.
 */

/**
 * @typedef {object} DetailableState state for detailable meshes:
 * @property {string} frontImage - path to its front image.
 * @property {string} backImage? - path to its back image, when relevant.
 */

/**
 * @typedef {object} MovableState state for movable meshes:
 * @property {number} duration? - move animation duration, in milliseconds.
 * @property {number} snapDistance? - distance between dots of an imaginary snap grid.
 * @property {string} kind? - kind used when dragging and droping the mesh over targets.
 */

/**
 * @typedef {object} FlippableState state for flippable meshes:
 * @property {boolean} isFlipped? - true means the back face is visible.
 * @property {number} duration? - flip animation duration, in milliseconds.
 */

/**
 * @typedef {object} RotableState state for flippable meshes:
 * @property {number} angle? - rotation angle along Y axis, in radian.
 * @property {number} duration? - rotation animation duration, in milliseconds.
 */

/**
 * @typedef {object} StackableState state for stackable meshes:
 * @property {string[]} stackIds? - ordered list of ids for meshes stacked on top of this one.
 * @property {number} duration? - stack animations duration, in milliseconds.
 * @property {string[]} kinds? - acceptable meshe kinds, that could be stacked on top of this one. Leave undefined to accept all.
 * @property {number} extent? - dimension multiplier applied to the drop target.
 * @property {number} priority? - priority applied when multiple targets with same altitude apply.
 */

/**
 * @typedef {object} AnchorableState state for anchorable meshes:
 * @property {Anchor[]} anchors? - list of anchors.
 * @property {number} duration? - snap animation duration, in milliseconds.
 */

/**
 * @typedef {object} Anchor a rectangular anchor definition:
 * @property {string} snappedId? - id of the mesh currently snapped to this anchor.
 * @property {number} x? - 3D coordinate (relative to the parent mesh) along the X axis (horizontal).
 * @property {number} z? - 3D coordinate (relative to the parent mesh) along the Z axis (vertical).
 * @property {number} y? - 3D coordinate (relative to the parent mesh) along the Y axis (altitude).
 * @property {number} width? - anchor's width (X axis).
 * @property {number} height? - anchor's height (Y axis).
 * @property {number} depth? - anchor's depth (Z axis).
 * @property {string[]} kinds? - acceptable meshe kinds, that could be snapped to the anchor. Leave undefined to accept all.
 * @property {number} priority? - priority applied when multiple targets with same altitude apply.
 */

/**
 * @typedef {object} DrawableState state for drawable meshes:
 * @property {boolean} [unflipOnPick=true] - unflip flipped mesh when picking them in hand.
 * @property {boolean} [flipOnPlay=false] - flip flipable meshes when playing them from hand.
 * @property {number} [duration=750] - duration (in milliseconds) of the draw animation.
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

/**
 * @typedef {object} Hand a player's private hand
 * @property {string} playerId - owner id.
 * @property {Mesh[]} meshes - ordered list of meshes.
 */

/**
 * @typedef {object} ZoomSpec zoom specifications for main and hand scene:
 * @property {number} min? - minimum zoom level allowed on the main scene.
 * @property {number} max? - maximum zoom level allowed on the main scene.
 * @property {number} initial? - initial zoom level for the main scene.
 * @property {number} hand? - fixed zoom level for the hand scene.
 */

const maxOwnedGames = 6

// https://colorkit.co/color-palette-generator/4297a0-ff4500-239646-9c3096-578c64-bf963d-e42256-83746e-2f435a/
const colors = [
  '#4297a0',
  '#ff4500',
  '#239646',
  '#9c3096',
  '#578c64',
  '#bf963d',
  '#e42256',
  '#83746e',
  '#2f435a'
]

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
 * @param {string} kind - game's kind.
 * @param {string} playerId - creating player id.
 * @returns {Promise<Game>} the created game.
 * @throws {Error} when no descriptor could be found for this kind.
 * @throws {Error} when this game is restricted and was not granted to player.
 * @throws {Error} when player already owns too many games.
 */
export async function createGame(kind, playerId) {
  const descriptor = await repositories.catalogItems.getById(kind)
  if (!descriptor) {
    throw new Error(`Unsupported game ${kind}`)
  }
  const player = await repositories.players.getById(playerId)
  if (!canAccess(player, descriptor)) {
    throw new Error(`Access to game ${kind} is restricted`)
  }

  const ownedCount = await countOwnGames(playerId)
  if (ownedCount >= maxOwnedGames) {
    throw new Error(`You own ${ownedCount} games, you can not create more`)
  }

  // trim some data out of the descriptor before saving it as game properties
  // eslint-disable-next-line no-unused-vars
  const { name, build, addPlayer, maxSeats, ...gameProps } = descriptor
  try {
    const game = await enrichWithPlayer(
      descriptor,
      {
        ...gameProps,
        kind,
        created: Date.now(),
        playerIds: [],
        availableSeats: (maxSeats ?? 2) - 1,
        meshes: await createMeshes(kind, descriptor),
        messages: [],
        cameras: [],
        hands: [],
        preferences: []
      },
      player
    )
    const created = await repositories.games.save(game)
    gameListsUpdate$.next(created.playerIds)
    return created
  } catch (err) {
    console.error(
      `Error thrown while building game ${kind}: ${err.message}`,
      err.stack
    )
    throw err
  }
}

/**
 * Deletes a game for a given player.
 * The operation will abort and return null when:
 * - no game could match this game id
 * - the player does not own the game
 * Updates game lists of all related players.
 * @param {string} gameId - loaded game id.
 * @param {string} playerId - player id.
 * @returns {Promise<Game|null>} the deleted game, or null.
 */
export async function deleteGame(gameId, playerId) {
  const game = await loadGame(gameId, playerId)
  if (game) {
    await repositories.games.deleteById(gameId)
    gameListsUpdate$.next(game.playerIds)
  }
  return game
}

/**
 * Loads a game for a given player.
 * The operation will abort and return null when:
 * - no game could match this game id
 * - the player does not own the game
 * @param {string} gameId - loaded game id.
 * @param {string} playerId - player id.
 * @returns {Promise<Game|null>} the loaded game, or null.
 */
export async function loadGame(gameId, playerId) {
  const game = await repositories.games.getById(gameId)
  if (!isOwner(game, playerId)) {
    return null
  }
  return game
}

/**
 * Saves an existing game.
 * The operation will abort and return null when:
 * - the player does not own the game
 * @param {Game} game - saved game.
 * @param {string} playerId - owner id.
 * @returns {Promise<Game|null>} the saved game, or null.
 */
export async function saveGame(game, playerId) {
  const previous = await loadGame(game?.id, playerId)
  if (previous) {
    return repositories.games.save({
      ...previous,
      meshes: game.meshes ?? previous.meshes,
      hands: game.hands ?? previous.hands,
      messages: game.messages ?? previous.messages,
      cameras: game.cameras ?? previous.cameras
    })
  }
  return null
}

/**
 * Invites a guest player into one of the inviting player's games.
 * The operation will abort and return null when:
 * - no game could match this game id
 * - the inviting player does not own the game
 * - the guest is already part of the game players
 * - the guest id is invalid
 * The operation will abort and throws when this game has no more availabe seats.
 * Updates game lists of all related players.
 * @param {string} gameId - shared game id.
 * @param {string} guestId - invited player id.
 * @param {string} hostId - inviting player id.
 * @returns {Promise<Game|null>} updated game, or null if the player can not be invited.
 * @throws {Error} when there are no available seats
 */
export async function invite(gameId, guestId, hostId) {
  const guest = await repositories.players.getById(guestId)
  let game = await loadGame(gameId, hostId)
  if (!game || !guest || game.playerIds.includes(guest.id)) {
    return null
  }
  if (game.availableSeats <= 0) {
    throw new Error('no more available seats')
  }
  game.availableSeats--
  try {
    game = await enrichWithPlayer(
      await repositories.catalogItems.getById(game.kind),
      game,
      guest
    )
  } catch (err) {
    console.error(
      `Error thrown while adding player to game ${game.kind} (${game.id}): ${err.message}`,
      err.stack
    )
    throw err
  }
  await repositories.games.save(game)
  gameListsUpdate$.next(game.playerIds)
  return game
}

async function enrichWithPlayer(descriptor, game, guest) {
  game.playerIds.push(guest.id)
  game.preferences.push({
    playerId: guest.id,
    color: pickRandom(
      colors,
      game.preferences.map(({ color }) => color)
    )
  })
  if (!descriptor?.addPlayer) {
    return game
  }
  game = await descriptor.addPlayer(game, guest)
  game.preferences
  return game
}

/**
 * Lists all games this players is in.
 * @param {string} playerId - player id.
 * @returns {Promise<Game[]>} a list of games (could be empty).
 */
export async function listGames(playerId) {
  return repositories.games.listByPlayerId(playerId)
}

/**
 * Updates game lists including a given player id. Usefull when updating a player's username.
 * @param {string} playerId - the player id which is triggering the update.
 * @return {Promise<void>}
 */
export async function notifyRelatedPlayers(playerId) {
  const playerIds = new Set()
  for (const game of await listGames(playerId)) {
    for (const playerId of game.playerIds) {
      playerIds.add(playerId)
    }
  }
  playerIds.delete(playerId)
  if (playerIds.size) {
    gameListsUpdate$.next([...playerIds])
  }
}

/**
 * Count the number of games a given player owns.
 * @param {string} playerId - id of the desired player.
 * @returns {Promise<number>} the number of owned games.
 */
export async function countOwnGames(playerId) {
  return (await listGames(playerId)).reduce(
    (count, { playerIds: [ownerId] }) => count + (ownerId === playerId ? 1 : 0),
    0
  )
}
