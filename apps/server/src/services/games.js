import Ajv from 'ajv/dist/2020.js'
import { concatMap, mergeMap, Subject } from 'rxjs'

import repositories from '../repositories/index.js'
import {
  createMeshes,
  enrichAssets,
  getParameterSchema,
  pickRandom
} from '../utils/index.js'
import { canAccess } from './catalog.js'

/**
 * @typedef {object} Game an active game, or a waiting room:
 * @property {string} id - unique game id.
 * @property {number} created - game creation timestamp.
 * @property {string} ownerId - id of the player who created this game
 * @property {string[]} playerIds - (active) player ids.
 * @property {string[]} guestIds - guest (future player) ids.
 * @property {string} kind? - game kind (relates with game descriptor). Unset means a waiting room.
 * @property {Mesh[]} meshes? - game meshes.
 * @property {Message[]} messages? - game discussion thread, if any.
 * @property {CameraPosition[]} cameras? - player's saved camera positions, if any.
 * @property {Hand[]} hands? - player's private hands, id any.
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
 * @typedef {object} Hand a player's private hand.
 * @property {string} playerId - owner id.
 * @property {Mesh[]} meshes - ordered list of meshes.
 */

/**
 * @typedef {object} ZoomSpec zoom specifications for main and hand scene.
 * @property {number} min? - minimum zoom level allowed on the main scene.
 * @property {number} max? - maximum zoom level allowed on the main scene.
 * @property {number} initial? - initial zoom level for the main scene.
 * @property {number} hand? - fixed zoom level for the hand scene.
 */

/**
 * @typedef {object} GameParameters parameters required to join a given game.
 * @property {string} id - game id to join.
 * @property {object} schema - a JSON Type Definition schema used to validate required parmeters.
 */

const maxOwnedGames = 6

// https://colorkit.co/color-palette-generator/9c3096-ff4500-239646-2349a9-686467-bf963d-a82424-1a85a2/
const colors = [
  '#9c3096', // violet
  '#ff4500', // orange-foncé
  '#239646', // vert
  '#2349a9', // bleu
  '#686467', // gris
  '#bf963d', // marron
  '#a82424', // rouge
  '#1a85a2' // cyan
]

const gameListsUpdate$ = new Subject()

const ajv = new Ajv({ $data: true, allErrors: true, strictSchema: false })

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
 * Creates a new game of a given kind, registering the creator as a guest.
 * If no kind is provided, the game is a simple lobby.
 * When kind is provided, it instanciates an unique set of meshes, based on the descriptor's bags and slots.
 * Notifies this player's for new game.
 * @param {string} kind - game's kind.
 * @param {object} player - creating player.
 * @returns {Promise<String>} the created game id.
 * @throws {Error} when no descriptor could be found for this kind.
 * @throws {Error} when this game is restricted and was not granted to player.
 * @throws {Error} when player already owns too many games.
 */
export async function createGame(kind, player) {
  await checkGameLimit(player)
  const descriptor = kind ? await findDescriptor(kind, player) : { maxSeats: 8 }

  // trim some data out of the descriptor before saving it as game properties
  // eslint-disable-next-line no-unused-vars
  const { name, build, addPlayer, askForParameters, maxSeats, ...gameProps } =
    descriptor
  const game = await repositories.games.save(
    enrichAssets({
      ...gameProps,
      kind,
      created: Date.now(),
      ownerId: player.id,
      playerIds: [],
      guestIds: [player.id],
      availableSeats: maxSeats ?? 2,
      meshes: kind ? await createMeshes(kind, descriptor) : [],
      messages: [],
      cameras: [],
      hands: [],
      preferences: []
    })
  )
  notifyAllPeers(game)
  return game
}

function notifyAllPeers(game) {
  gameListsUpdate$.next([...game.playerIds, ...game.guestIds])
}

async function checkGameLimit(player, excludedGameIds = []) {
  const ownedCount = await countOwnGames(player.id, excludedGameIds)
  if (ownedCount >= maxOwnedGames) {
    throw new Error(`You own ${ownedCount} games, you can not create more`)
  }
}

async function findDescriptor(kind, player) {
  const descriptor = await repositories.catalogItems.getById(kind)
  if (!descriptor) {
    throw new Error(`Unsupported game ${kind}`)
  }
  if (!canAccess(player, descriptor)) {
    throw new Error(`Access to game ${kind} is restricted`)
  }
  return descriptor
}

/**
 * Promote a lobby into a full game, setting its kind.
 * All players will be downgraded to guests, and will have to join again.
 * The operation will abort and return null when:
 * - no game could match this game id
 * - requesting user is not a player.
 * May returns parameters if needed, or the actual game content.
 * @param {string} gameId - loaded game id.
 * @param {string} kind - game's kind.
 * @param {object} player - joining guest
 * @returns {Promise<Game|GameParameters|null>} the promoted game, its parameters, or null.
 * @throws {Error} when no descriptor could be found for this kind.
 * @throws {Error} when this game is restricted and was not granted to player.
 * @throws {Error} when player already owns too many games (not counting this one).
 * @throws {Error} when the promotted game is not a lobby.
 */
export async function promoteGame(gameId, kind, player) {
  const lobbyOrGame = await repositories.games.getById(gameId)
  if (!isPlayer(lobbyOrGame, player.id)) {
    return null
  }
  if (lobbyOrGame.kind) {
    throw new Error(`Game ${gameId} is already a full game`)
  }
  await checkGameLimit(player, [gameId])
  const descriptor = await findDescriptor(kind, player)

  // trim some data out of the descriptor before saving it as game properties
  // eslint-disable-next-line no-unused-vars
  const { name, build, addPlayer, askForParameters, maxSeats, ...gameProps } =
    descriptor
  const availableSeats = maxSeats ?? 2
  // TODO allow users selecting who should enter game
  const guestIds = lobbyOrGame.playerIds
    .concat(lobbyOrGame.guestIds)
    .slice(0, availableSeats)
  const game = await repositories.games.save(
    enrichAssets({
      ...lobbyOrGame,
      ...gameProps,
      kind,
      ownerId: player.id,
      playerIds: [],
      guestIds,
      availableSeats,
      meshes: await createMeshes(kind, descriptor),
      preferences: []
    })
  )
  notifyAllPeers(game)
  return game
}

function isPlayer(game, playerId) {
  return game?.playerIds.includes(playerId)
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
  const game = await repositories.games.getById(gameId)
  if (!isOwner(game, playerId)) {
    return null
  }
  await repositories.games.deleteById(gameId)
  notifyAllPeers(game)
  return game
}

function isOwner(game, playerId) {
  return game?.ownerId === playerId
}

/**
 * Allows a player to load the game content.
 * Allows a guest to join a game with given parameters.
 * Will return new parameters if provided values didn't matched expected schema.
 * If they do, will turn the guest into a player.
 * The operation will abort and return null when:
 * - no game could match this game id.
 * - requesting user is neither a player nor a guest.
 * - the player is not a guest
 * @param {string} gameId - loaded game id.
 * @param {object} player - joining guest
 * @param {object} parameters - parameters values for this player, when joining for the first time.
 * @returns {Promise<Game|GameParameters|null>} the loaded game, its parameters, or null.
 * @throws {Error} when player is a guest and the game has no more availabe seats.
 * @throws {Error} when player is a guest and an error occured while adding them.
 */
export async function joinGame(gameId, player, parameters) {
  let game = await repositories.games.getById(gameId)
  if (isPlayer(game, player.id)) {
    return game
  }
  if (!isGuest(game, player?.id)) {
    return null
  }
  if (game.availableSeats <= 0) {
    throw new Error('no more available seats')
  }
  try {
    let descriptor
    if (game.kind) {
      descriptor = await repositories.catalogItems.getById(game.kind)
      const gameParameters = await getParameterSchema({
        descriptor,
        game,
        player
      })
      if (gameParameters && !parameters) {
        return gameParameters
      }
      const error = validateParameters(gameParameters?.schema, parameters)
      if (error) {
        return { ...gameParameters, error }
      }
    }
    game.availableSeats--
    game = await enrichWithPlayer({
      descriptor,
      game,
      guest: player,
      parameters
    })
    game = await repositories.games.save(game)
    notifyAllPeers(game)
    return game
  } catch (err) {
    console.error(
      `Error thrown for player ${player.id} while joining game ${game.kind} (${game.id}): ${err.message}`,
      err.stack
    )
    throw err
  }
}

function isGuest(game, guestId) {
  return game?.guestIds.indexOf(guestId) >= 0
}

function validateParameters(schema, parameters) {
  if (schema && !ajv.validate(schema, parameters)) {
    return ajv.errors
      .map(({ instancePath, message }) =>
        [instancePath, message].filter(Boolean).join(' ')
      )
      .join('\n')
  }
}

async function enrichWithPlayer({ descriptor, game, guest, parameters }) {
  game.playerIds.push(guest.id)
  game.guestIds.splice(game.guestIds.indexOf(guest.id), 1)
  if (descriptor) {
    game.preferences.push({
      playerId: guest.id,
      color: pickRandom(
        colors,
        game.preferences.map(({ color }) => color)
      )
    })
  }
  if (!descriptor?.addPlayer) {
    return game
  }
  return enrichAssets(await descriptor.addPlayer(game, guest, parameters))
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
  const previous = await repositories.games.getById(game?.id)
  if (!isPlayer(previous, playerId)) {
    return null
  }
  return repositories.games.save({
    ...previous,
    meshes: game.meshes ?? previous.meshes,
    hands: game.hands ?? previous.hands,
    messages: game.messages ?? previous.messages,
    cameras: game.cameras ?? previous.cameras
  })
}

/**
 * Invites a guest player into one of the inviting player's games.
 * The operation will abort and return null when:
 * - no game could match this game id
 * - the inviting player does not own the game
 * - the guest was already invited
 * - the guest id is invalid
 * Updates game lists of all related players.
 * @param {string} gameId - shared game id.
 * @param {string} guestId - invited player id.
 * @param {string} hostId - inviting player id.
 * @returns {Promise<Game|null>} updated game, or null if the player can not be invited.
 */
export async function invite(gameId, guestId, hostId) {
  const guest = await repositories.players.getById(guestId)
  const game = await repositories.games.getById(gameId)
  if (
    (!isPlayer(game, hostId) && !isOwner(game, hostId)) ||
    !guest ||
    [...game.playerIds, ...game.guestIds].includes(guest.id)
  ) {
    return null
  }
  game.guestIds.push(guest.id)
  await repositories.games.save(game)
  notifyAllPeers(game)
  return game
}

/**
 * Lists all games this players is in.
 * @param {string} playerId - player id.
 * @returns {Promise<Game[]>} a list of games (could be empty).
 */
export async function listGames(playerId) {
  return (await repositories.games.listByPlayerId(playerId)).filter(Boolean)
}

/**
 * Updates game lists including a given player id. Usefull when updating a player's username.
 * @param {string} playerId - the player id which is triggering the update.
 * @return {Promise<void>}
 */
export async function notifyRelatedPlayers(playerId) {
  const playerIds = new Set()
  for (const game of await listGames(playerId)) {
    for (const playerId of [...game.playerIds, ...game.guestIds]) {
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
 * @param {string[]} excludedGameId? - optional list of game ids to exclude from the count.
 * @returns {Promise<number>} the number of owned games.
 */
export async function countOwnGames(playerId, excludedGameIds = []) {
  return (await listGames(playerId)).reduce(
    (count, { id, ownerId }) =>
      count + (ownerId === playerId && !excludedGameIds.includes(id) ? 1 : 0),
    0
  )
}
