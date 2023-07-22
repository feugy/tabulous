// @ts-check
import Ajv from 'ajv/dist/2020.js'
import { concatMap, mergeMap, Subject } from 'rxjs'

import repositories from '../repositories/index.js'
import {
  FriendshipAccepted,
  FriendshipProposed
} from '../repositories/players.js'
import {
  createMeshes,
  enrichAssets,
  getParameterSchema,
  makeLogger,
  pickRandom
} from '../utils/index.js'
import { canAccess } from './catalog.js'

/** @typedef {import('./players.js').Player} Player */
/** @typedef {import('./catalog.js').GameDescriptor} GameDescriptor */

/**
 * @typedef {object} Game an active game, or a lobby
 * @property {string} id - unique game id.
 * @property {number} created - game creation timestamp.
 * @property {string} ownerId - id of the player who created this game
 * @property {string} [kind] - game kind (relates with game descriptor). Unset means a waiting room.
 * @property {string[]} playerIds - (active) player ids.
 * @property {string[]} guestIds - guest (future player) ids.
 */

/**
 * @typedef {object} _GameData
 * @property {number} availableSeats - number of seats still available.
 * @property {Mesh[]} meshes - game meshes.
 * @property {Message[]} messages - game discussion thread, if any.
 * @property {CameraPosition[]} cameras - player's saved camera positions, if any.
 * @property {Hand[]} hands - player's private hands, id any.
 * @property {PlayerPreference[]} preferences - preferences for each players.
 */
/** @typedef {Game & GameDescriptor & _GameData} GameData */
/** @typedef {GameData & Required<Pick<GameData, 'meshes'|'hands'|'kind'>>} StartedGameData */

/**
 * @typedef {'box'|'card'|'custom'|'die'|'prism'|'roundedTile'|'roundToken'} Shape
 */

/**
 * @typedef {object} Point
 * @property {number} [x] - 3D coordinate along the X axis (horizontal).
 * @property {number} [z] - 3D coordinate along the Z axis (vertical).
 * @property {number} [y] - 3D coordinate along the Y axis (altitude).
 */

/**
 * @typedef {object} Dimension
 * @property {number} [width] - mesh's width (X axis), for boxes, cards, prisms, and rounded tiles.
 * @property {number} [height] - mesh's height (Y axis), for boxes, cards, prisms, rounded tokens and rounded tiles.
 * @property {number} [depth] - mesh's depth (Z axis), for boxes, cards, and rounded tiles.
 * @property {number} [diameter] - mesh's diameter (X+Z axis), for round tokens and dice.
 */

/**
 * @typedef {object} _Mesh a 3D mesh, with a given shape. Some of its attribute are shape-specific:
 * @property {Shape} shape - the mesh shape.
 * @property {string} id - mesh unique id.
 * @property {string} texture - path to its texture file or hex color.
 * @property {number[][]} [faceUV] - list of face UV (Vector4 components), to map texture on the mesh (depends on its shape).
 * @property {InitialTransform} [transform] - initial transformation baked into the mesh's vertices.
 * @property {number} [borderRadius] - corner radius, for rounded tiles.
 * @property {string} [file] - path to the custom mesh OBJ file.
 * @property {number} [edge] - number of edge, for prisms.
 * @property {number} [prismRotation] - initial rotation angle, baked in vertices, for prisms.
 * @property {number} [faces] - number of faces, for dice.
 * @property {DetailableState} [detailable] - if this mesh could be detailed, contains details.
 * @property {MovableState} [movable] - if this mesh could be moved, contains move state.
 * @property {FlippableState} [flippable] - if this mesh could be flipped, contains flip state.
 * @property {RotableState} [rotable] - if this mesh could be rotated along Y axis, contains rotation state.
 * @property {AnchorableState} [anchorable] - if this mesh has anchors, contains their state.
 * @property {StackableState} [stackable] - if this mesh could be stack under others, contains stack state.
 * @property {DrawableState} [drawable] - if this mesh could be drawn in player hand, contains coonfiguration.
 * @property {LockableState} [lockable] - if this mesh could be locked, contains (un)locke state.
 * @property {QuantifiableState} [quantifiable] - if instances of this mesh could grouped together and split, contains quantity state.
 * @property {RandomizableState} [randomizable] - if this mesh could be randomized, contains face state.
 */
/** @typedef {_Mesh & Point & Dimension} Mesh */

/**
 * @typedef {object} Targetable commonn properties for targets (stacks, anchors, quantifiable...)
 * @property {string[]} [kinds] - acceptable meshe kinds, that could be snapped to the anchor. Leave undefined to accept all.
 * @property {number} [extent=2] - dimension multiplier applied to the drop target.
 * @property {number} [priority=0] - priority applied when multiple targets with same altitude apply.
 * @property {boolean} [enabled=true] - whether this anchor is enabled or not.
 */

/**
 * @typedef {object} InitialTransform
 * @property {number} [yaw=0] - rotation along the Y axis.
 * @property {number} [pitch=0] - rotation along the X axis.
 * @property {number} [roll=0] - rotation along the Z axis.
 * @property {number} [scaleX=1] - scale applied along the X axis.
 * @property {number} [scaleY=1] - scale applied along the Y axis.
 * @property {number} [scaleZ=1] - scale applied along the Z axis.
 */

/**
 * @typedef {object} DetailableState state for detailable meshes:
 * @property {string} frontImage - path to its front image.
 * @property {string} [backImage] - path to its back image, when relevant.
 */

/**
 * @typedef {object} MovableState state for movable meshes:
 * @property {number} [duration=100] - move animation duration, in milliseconds.
 * @property {number} [snapDistance=0.25] - distance between dots of an imaginary snap grid.
 * @property {string} [kind] - kind used when dragging and droping the mesh over targets.
 * @property {Point[]} [partCenters] - when this mesh has serveral parts, coordinate of each part barycenter.
 */

/**
 * @typedef {object} FlippableState state for flippable meshes:
 * @property {boolean} [isFlipped=false] - true means the back face is visible.
 * @property {number} [duration=500] - flip animation duration, in milliseconds.
 */

/**
 * @typedef {object} RotableState state for flippable meshes:
 * @property {number} [angle=0] - rotation angle along Y axis (yaw), in radian.
 * @property {number} [duration=200] - rotation animation duration, in milliseconds.
 */

/**
 * @typedef {object} _StackableState state for stackable meshes:
 * @property {string[]} [stackIds=[]] - ordered list of ids for meshes stacked on top of this one.
 * @property {number} [duration=100] - stack animations duration, in milliseconds.
 * @property {number} [angle] - angle applied to any rotable mesh pushed to the stack.
 */
/** @typedef {_StackableState & Targetable} StackableState */

/**
 * @typedef {object} AnchorableState state for anchorable meshes:
 * @property {Anchor[]} [anchors] - list of anchors.
 * @property {number} [duration=100] - snap animation duration, in milliseconds.
 */

/**
 * @typedef {object} _Anchor a rectangular anchor definition (coordinates are relative to the parent mesh):
 * @property {string} id - this anchor id.
 * @property {?string} [snappedId] - id of the mesh currently snapped to this anchor.
 * @property {string} [playerId] - when set, only this player can snap meshes to this anchor.
 * @property {number} [angle] - angle applied to any rotable mesh snapped to the anchor.
 * @property {boolean} [ignoreParts=false] - when set, and when snapping a multi-part mesh, takes it barycenter into account.
 */
/** @typedef {_Anchor & Point & Dimension & Targetable} Anchor */

/**
 * @typedef {object} DrawableState state for drawable meshes:
 * @property {boolean} [unflipOnPick=true] - unflip flipped mesh when picking them in hand.
 * @property {boolean} [flipOnPlay=false] - flip flipable meshes when playing them from hand.
 * @property {number} [angleOnPick=0] - set angle of rotable meshes when picking them in hand.
 * @property {number} [duration=750] - duration (in milliseconds) of the draw animation.
 */

/**
 * @typedef {object} LockableState state for locable mehes:
 * @property {boolean} [isLocked=false] - whether this mesh is locked or not.
 */

/**
 * @typedef {object} _QuantifiableState behavior persistent state, including:
 * @property {number} [quantity=1] - number of items, including this one.
 * @property {number} [duration=100] - duration (in milliseconds) when pushing individual meshes.
 */
/** @typedef {Targetable & _QuantifiableState} QuantifiableState */

/**
 * @typedef {object} RandomizableState
 * @property {number} [face=1] - current face set.
 * @property {number} [duration=600] - duration (in milliseconds) of the random animation. The set animartion is a third of it.
 * @property {boolean} [canBeSet=false] - whether face could be manually set or not.
}
 */
/**
 * @typedef {object} Message a message in the discussion thread:
 * @property {string} playerId - sender id.
 * @property {string} text - message's textual content.
 * @property {number} time - creation timestamp.
 */

/**
 * @typedef {object} CameraPosition a saved Arc rotate camera position
 * @property {string} hash - hash for this position, to ease comparisons and change detections.
 * @property {string} playerId - id of the player for who this camera position is relevant.
 * @property {number} index - 0-based index for this saved position.
 * @property {number[]} target - 3D cooordinates of the camera target, as per Babylon's specs.
 * @property {number} alpha  - the longitudinal rotation, in radians.
 * @property {number} beta - the longitudinal rotation, in radians.
 * @property {number} elevation - the distance from the target (Babylon's radius).
 * @see https://doc.babylonjs.com/divingDeeper/cameras/camera_introduction#arc-rotate-camera
 */

/**
 * @typedef {object} Hand a player's private hand.
 * @property {string} playerId - owner id.
 * @property {Mesh[]} meshes - ordered list of meshes.
 */

/**
 * @typedef {object} _PlayerPreference
 * @property {string} playerId - if of this player.
 * @property {string} [color] - hex color for this player, if any.
 * @property {number} [angle] - yaw (Y angle) on the table, if any.
 */

/** @typedef {Record<string, any> & _PlayerPreference} PlayerPreference */

/** @typedef {import('ajv').JSONSchemaType<?>} Schema */

/**
 * @typedef {object} _GameParameters parameters required to join a given game.
 * @property {Schema} schema - a JSON Type Definition schema used to validate required parmeters.
 * @property {string} [error] - validation error, when relevant.
 */
/** @typedef {GameData & _GameParameters} GameParameters */

const maxOwnedGames = 6

const logger = makeLogger('games-service')

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

/** @type {Subject<string[]>} */
const gameListsUpdate$ = new Subject()

const ajv = new Ajv({ $data: true, allErrors: true, strictSchema: false })

/**
 * @typedef {object} GameListUpdate an updated list of player games.
 * @property {string} playerId - the corresponding player id.
 * @property {Game[]} games - their games.
 */

/**
 * Emits updates of game list for individual players.
 * @type {import('rxjs').Observable<GameListUpdate>}
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
 * @param {string|undefined} kind - game's kind.
 * @param {Player} player - creating player.
 * @returns {Promise<GameData>} the created game.
 * @throws {Error} when no descriptor could be found for this kind.
 * @throws {Error} when this game is restricted and was not granted to player.
 * @throws {Error} when player already owns too many games.
 */
export async function createGame(kind, player) {
  const ctx = { playerId: player.id, kind }
  logger.trace({ ctx }, 'creating new game')
  await checkGameLimit(player)
  /** @type {Partial<GameDescriptor>} */
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
  logger.debug({ ctx, res: serializeForLogs(game) }, 'created new game')
  return game
}

/**
 * Triggers notification of a game's players and guests.
 * @param {Game} game - notified game.
 * @param {string[]} extras - extra notified player id
 */
function notifyAllPeers(game, ...extras) {
  gameListsUpdate$.next([...game.playerIds, ...game.guestIds, ...extras])
}

/**
 * @param {Player} player - player to check game limit.
 * @param {string[]} excludedGameIds - list of game ids to exclude from counting.
 * @throws {Error} when this player reached the game limit.
 */
async function checkGameLimit(player, excludedGameIds = []) {
  const ownedCount = await countOwnGames(player.id, excludedGameIds)
  if (ownedCount >= maxOwnedGames) {
    throw new Error(`You own ${ownedCount} games, you can not create more`)
  }
}

/**
 * @param {string} name - catalog item name.
 * @param {Player} player - player accessing this game.
 * @returns {Promise<GameDescriptor>}
 */
async function findDescriptor(name, player) {
  const descriptor = await repositories.catalogItems.getById(name)
  if (!descriptor) {
    throw new Error(`Unsupported game ${name}`)
  }
  if (!canAccess(player, descriptor)) {
    throw new Error(`Access to game ${name} is restricted`)
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
 * @param {Player} player - joining guest
 * @returns {Promise<?GameData|GameParameters>} the promoted game, its parameters, or null.
 * @throws {Error} when no descriptor could be found for this kind.
 * @throws {Error} when this game is restricted and was not granted to player.
 * @throws {Error} when player already owns too many games (not counting this one).
 * @throws {Error} when the promotted game is not a lobby.
 * @throws {Error} when the lobby has more players than available seats.
 */
export async function promoteGame(gameId, kind, player) {
  const ctx = { playerId: player.id, kind, gameId }
  logger.trace({ ctx }, 'promoting lobby into a game')
  const lobbyOrGame = await repositories.games.getById(gameId)
  if (!lobbyOrGame || !isPlayer(lobbyOrGame, player.id)) {
    return null
  }
  if (lobbyOrGame.kind) {
    throw new Error(`Game ${gameId} is already a full game`)
  }
  await checkGameLimit(player, [gameId])
  // TODO descriptor may not exist!
  const descriptor = await findDescriptor(kind, player)

  // trim some data out of the descriptor before saving it as game properties
  // eslint-disable-next-line no-unused-vars
  const { name, build, addPlayer, askForParameters, maxSeats, ...gameProps } =
    descriptor
  const availableSeats = maxSeats ?? 2
  checkAvailableSeats(lobbyOrGame, availableSeats)
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
  logger.debug(
    { ctx, res: serializeForLogs(game) },
    'promotted looby into game'
  )
  return game
}

/**
 * @param {?Game} game - checked game.
 * @param {string} userId - user to check.
 * @returns {boolean} whether this user is a player of the game
 */
function isPlayer(game, userId) {
  return game?.playerIds.includes(userId) ?? false
}

/**
 * @param {Game} lobby - game to check.
 * @param {number} availableSeats - maximum seats allowed.
 * @throws {Error} when this games has not more available seats.
 */
function checkAvailableSeats(lobby, availableSeats) {
  const playerCount = lobby.playerIds.length
  if (playerCount > availableSeats) {
    throw new Error(
      `This game only has ${availableSeats} seats and you are ${playerCount}`
    )
  }
}

/**
 * Deletes a game for a given player.
 * The operation will abort and return null when:
 * - no game could match this game id
 * - the player does not own the game or is not an admin
 * Updates game lists of all related players.
 * @param {string} gameId - loaded game id.
 * @param {Player} player - deleting player.
 * @returns {Promise<?GameData>} the deleted game, or null.
 */
export async function deleteGame(gameId, player) {
  const ctx = { playerId: player.id, gameId }
  logger.trace({ ctx }, 'deleting game')
  const game = await repositories.games.getById(gameId)
  if (!game || !(isOwner(game, player?.id) || isAdmin(player))) {
    return null
  }
  await repositories.games.deleteById(gameId)
  notifyAllPeers(game)
  logger.debug({ ctx, res: serializeForLogs(game) }, 'deleted game')
  return game
}

/**
 * @param {?Game} game - checked game.
 * @param {string} playerId - player to check.
 * @returns {boolean} whether this player owns the game or not.
 */
function isOwner(game, playerId) {
  return game?.ownerId === playerId
}

/**
 * @param {?Player} player - checked player.
 * @returns {boolean} whether this player is an admin or not.
 */
function isAdmin(player) {
  return player?.isAdmin === true
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
 * @param {Player} player - joining guest
 * @param {?object} [parameters] - parameters values for this player, when joining for the first time.
 * @returns {Promise<?GameData|GameParameters>} the loaded game, its parameters, or null.
 * @throws {Error} when player is a guest and the game has no more availabe seats.
 * @throws {Error} when player is a guest and an error occured while adding them.
 */
export async function joinGame(gameId, player, parameters) {
  const ctx = { playerId: player.id, gameId, parameters }
  logger.trace({ ctx }, 'joining game')
  const maybeGame = await repositories.games.getById(gameId)
  if (!maybeGame) {
    return null
  }
  if (isPlayer(maybeGame, player.id)) {
    return maybeGame
  }
  if (!isGuest(maybeGame, player?.id)) {
    return null
  }
  if (maybeGame.availableSeats <= 0) {
    throw new Error('no more available seats')
  }
  const game = /** @type {StartedGameData}*/ (maybeGame)
  try {
    /** @type {?GameDescriptor} */
    let descriptor = null
    if (game.kind) {
      descriptor = await repositories.catalogItems.getById(game.kind)
      const gameParameters = await getParameterSchema({
        descriptor,
        game,
        player
      })
      if (gameParameters) {
        if (!parameters) {
          logger.debug(
            { ctx, res: serializeForLogs(gameParameters) },
            'returned game parameters'
          )
          return gameParameters
        }
        const error = validateParameters(gameParameters.schema, parameters)
        if (error) {
          gameParameters.error = error
          logger.debug(
            { ctx, res: serializeForLogs(gameParameters) },
            'returned game parameters with error'
          )
          return gameParameters
        }
      }
    }
    const savedGame = await repositories.games.save(
      await enrichWithPlayer({
        descriptor,
        game,
        guest: player,
        parameters: parameters ?? null
      })
    )
    notifyAllPeers(savedGame)
    logger.debug({ ctx, res: serializeForLogs(savedGame) }, 'joined game')
    return savedGame
  } catch (error) {
    logger.warn(
      { ctx, error },
      `Error thrown for player ${player.id} while joining game ${game.kind} (${
        game.id
      }): ${error instanceof Error ? error.message : error}`
    )
    throw error
  }
}

/**
 * @param {?Game} game - checked game.
 * @param {string} userId - user to check.
 * @returns {boolean} whether this user is a guest or not.
 */
function isGuest(game, userId) {
  return (game?.guestIds ?? []).indexOf(userId) >= 0
}

/**
 * @param {Schema} schema - JSONSchema to validate
 * @param {object} parameters - validated object
 * @returns {string|undefined} a validation error string or undefined
 */
function validateParameters(schema, parameters) {
  if (schema && !ajv.validate(schema, parameters)) {
    return /** @type {import('ajv').ErrorObject[]}*/ (ajv.errors)
      .map(({ instancePath, message }) =>
        [instancePath, message].filter(Boolean).join(' ')
      )
      .join('\n')
  }
}

/**
 * Turns a guest into a full player.
 * If the descriptor is provided, guest is added to a game, and this optionaly provided parameters
 * are used.
 * If the descriptor is missing, guest is added to a lobby.
 * @param {object} args
 * @param {?GameDescriptor} args.descriptor - game descriptor.
 * @param {StartedGameData} args.game - full game data.
 * @param {Player} args.guest - guest who is becoming a player.
 * @param {?{ color?: string }} args.parameters - parameters provided by the guest.
 * @returns {Promise<StartedGameData>} enriched game data.
 */
async function enrichWithPlayer({ descriptor, game, guest, parameters }) {
  game.playerIds.push(guest.id)
  game.guestIds.splice(game.guestIds.indexOf(guest.id), 1)
  game.availableSeats--
  if (descriptor) {
    game.preferences.push({
      playerId: guest.id,
      color:
        parameters?.color ??
        pickRandom(
          game.colors?.players ?? colors,
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
 * @param {Partial<GameData>} game - saved game.
 * @param {string} playerId - saving playerId id.
 * @returns {Promise<?GameData>} the saved game, or null.
 */
export async function saveGame(game, playerId) {
  const ctx = { playerId, gameId: game.id }
  logger.trace({ ctx }, 'saving game')
  const previous = await repositories.games.getById(game?.id)
  if (!previous || !isPlayer(previous, playerId)) {
    return null
  }
  const saved = await repositories.games.save({
    ...previous,
    meshes: game.meshes ?? previous.meshes,
    hands: game.hands ?? previous.hands,
    messages: game.messages ?? previous.messages,
    cameras: game.cameras ?? previous.cameras
  })
  logger.debug({ ctx, res: serializeForLogs(saved) }, 'saved game')
  return saved
}

/**
 * Invites guest players into one of the inviting player's games.
 * The operation will abort and return null when:
 * - no game could match this game id
 * - the inviting player does not own the game
 * It will ignore guest who are invalid, not friends of host, already invited or already playing
 * Updates game lists of all related players.
 * @param {string} gameId - shared game id.
 * @param {string[]} guestIds - invited player ids.
 * @param {string} playerId - inviting player id.
 * @returns {Promise<?GameData>} updated game, or null
 */
export async function invite(gameId, guestIds, playerId) {
  const ctx = { playerId, gameId, guestIds }
  logger.trace({ ctx }, 'inviting to game')
  const guests = /** @type {Player[]} */ (
    ((await repositories.players.getById(guestIds)) ?? []).filter(Boolean)
  )
  let gameOrLobby = await repositories.games.getById(gameId)
  if (
    !gameOrLobby ||
    (!isPlayer(gameOrLobby, playerId) && !isOwner(gameOrLobby, playerId))
  ) {
    return null
  }
  const friendships = await repositories.players.listFriendships(playerId)
  const newIds = []
  for (const { id: guestId } of guests) {
    if (
      !isGuestAlreadyPlaying(guestId, gameOrLobby) &&
      isGuestAFriend(guestId, friendships)
    ) {
      newIds.push(guestId)
    }
  }
  if (newIds.length) {
    gameOrLobby.guestIds.push(...newIds)
    gameOrLobby = await repositories.games.save(gameOrLobby)
    notifyAllPeers(gameOrLobby)
  }
  logger.debug({ ctx, res: serializeForLogs(gameOrLobby) }, 'invited to game')
  return gameOrLobby
}

/**
 * @param {string} userId - checked user id.
 * @param {Game} game - checked game.
 * @returns {boolean} whether this user is already in players or guest of this game.
 */
function isGuestAlreadyPlaying(userId, { playerIds, guestIds }) {
  return playerIds.includes(userId) || guestIds.includes(userId)
}

/**
 * @param {string} guestId - checked guest id.
 * @param {import('../repositories/players.js').Friendship[]} friendships - current player existing relationships.
 * @returns {boolean} whether this guest is a friend of the current player.
 */
function isGuestAFriend(guestId, friendships) {
  return friendships.some(
    ({ id, state }) =>
      id === guestId &&
      (state === FriendshipProposed || state === FriendshipAccepted)
  )
}

/**
 * Kicks a someone from a game or a lobby.
 * Some limitations:
 * - owner can never be kicked
 * - guest can not kick others
 * - players of started games can not be kicked
 * - users can not kick themselves
 * @param {string} gameId - the game or lobby id.
 * @param {string} kickedId - the kicked user id.
 * @param {string} playerId - the kicking player id.
 * @returns {Promise<?GameData>} updated game data.
 */
export async function kick(gameId, kickedId, playerId) {
  const ctx = { playerId, gameId, kickedId }
  logger.trace({ ctx }, 'kicking from game')
  let gameOrLobby = await repositories.games.getById(gameId)
  if (
    !gameOrLobby ||
    !isPlayer(gameOrLobby, playerId) || // kicker is not a player
    !(
      isGuest(gameOrLobby, kickedId) || // kicked is not a guest
      // kicked is neither a lobby player
      (isPlayer(gameOrLobby, kickedId) && !gameOrLobby.kind)
    ) ||
    kickedId === gameOrLobby?.ownerId // kicked is the owner
  ) {
    return null
  }
  const guestIndex = gameOrLobby.guestIds.indexOf(kickedId)
  const playerIndex = gameOrLobby.playerIds.indexOf(kickedId)
  if (guestIndex !== -1) {
    gameOrLobby.guestIds.splice(guestIndex, 1)
  } else if (playerIndex !== -1) {
    gameOrLobby.playerIds.splice(playerIndex, 1)
    gameOrLobby.availableSeats++
  }
  if (guestIndex !== -1 || playerIndex !== -1) {
    gameOrLobby = await repositories.games.save(gameOrLobby)
    notifyAllPeers(gameOrLobby, kickedId)
  }
  logger.debug({ ctx, res: serializeForLogs(gameOrLobby) }, 'kicked from game')
  return gameOrLobby
}

/**
 * Lists all games this players is in.
 * @param {string} playerId - player id.
 * @returns {Promise<GameData[]>} a list of games (could be empty).
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
 * @param {string[]} [excludedGameIds] - optional list of game ids to exclude from the count.
 * @returns {Promise<number>} the number of owned games.
 */
export async function countOwnGames(playerId, excludedGameIds = []) {
  return (await listGames(playerId)).reduce(
    (count, { id, ownerId }) =>
      count + (ownerId === playerId && !excludedGameIds.includes(id) ? 1 : 0),
    0
  )
}

/**
 * @param {GameData|GameParameters} game - serialized game
 * @returns {object} important serialized fields
 */
function serializeForLogs({
  id,
  kind,
  ownerId,
  availableSeats,
  playerIds,
  guestIds,
  // @ts-expect-error: only defined on GameParameters
  schema,
  // @ts-expect-error: only defined on GameParameters
  error
}) {
  return {
    id,
    kind,
    ownerId,
    availableSeats,
    playerIds,
    guestIds,
    schema,
    error
  }
}
