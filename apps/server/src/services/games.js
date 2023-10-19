// @ts-check
import {
  createMeshes,
  enrichAssets,
  pickRandom,
  reportReusedIds
} from '@tabulous/game-utils'
import { concatMap, mergeMap, Subject } from 'rxjs'

import * as repositories from '../repositories/index.js'
import {
  FriendshipAccepted,
  FriendshipProposed
} from '../repositories/players.js'
import { ajv, getParameterSchema, makeLogger } from '../utils/index.js'
import { canAccess } from './catalog.js'

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

/** @type {Subject<import('@tabulous/types').Game[]>} */
const gameKindUpdate$ = new Subject()

/**
 * @typedef {object} GameListUpdate an updated list of player games.
 * @property {string} playerId - the corresponding player id.
 * @property {import('@tabulous/types').Game[]} games - their games.
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
 * Emits updates of game list for individual players.
 */
export const gameKindUpdate = gameKindUpdate$.asObservable()

/**
 * Creates a new game of a given kind, registering the creator as a guest.
 * If no kind is provided, the game is a simple lobby.
 * When kind is provided, it instanciates an unique set of meshes, based on the descriptor's bags and slots.
 * Notifies this player's for new game.
 * @param {string|undefined} kind - game's kind.
 * @param {import('@tabulous/types').Player} player - creating player.
 * @returns the created game.
 * @throws {Error} when no descriptor could be found for this kind.
 * @throws {Error} when this game is restricted and was not granted to player.
 * @throws {Error} when player already owns too many games.
 */
export async function createGame(kind, player) {
  const ctx = { playerId: player.id, kind }
  logger.trace({ ctx }, 'creating new game')
  await checkGameLimit(player)
  const descriptor = kind
    ? await findDescriptor(kind, player)
    : /** @type {Partial<import('@tabulous/types').GameDescriptor>} */ ({
        maxSeats: 8
      })

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
  reportReusedIds(game)
  notifyAllPeers(game)
  logger.debug({ ctx, res: serializeForLogs(game) }, 'created new game')
  return game
}

/**
 * Triggers notification of a game's players and guests.
 * @param {import('@tabulous/types').Game} game - notified game.
 * @param {string[]} extras - extra notified player id
 */
function notifyAllPeers(game, ...extras) {
  gameListsUpdate$.next([...game.playerIds, ...game.guestIds, ...extras])
}

/**
 * @param {import('@tabulous/types').Player} player - player to check game limit.
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
 * @param {import('@tabulous/types').Player} player - player accessing this game.
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
 * @param {import('@tabulous/types').Player} player - joining guest
 * @returns the promoted game or null.
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
  reportReusedIds(game)
  notifyAllPeers(game)
  game.engineScript = await repositories.catalogItems.getEngineScript(kind)
  logger.debug(
    { ctx, res: serializeForLogs(game) },
    'promotted looby into game'
  )
  return game
}

/**
 * @param {?import('@tabulous/types').Game} game - checked game.
 * @param {string} userId - user to check.
 * @returns whether this user is a player of the game
 */
function isPlayer(game, userId) {
  return game?.playerIds.includes(userId) ?? false
}

/**
 * @param {import('@tabulous/types').Game} lobby - game to check.
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
 * @param {import('@tabulous/types').Player} player - deleting player.
 * @returns the deleted game, or null.
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
 * @param {?import('@tabulous/types').Game} game - checked game.
 * @param {string} playerId - player to check.
 * @returns whether this player owns the game or not.
 */
function isOwner(game, playerId) {
  return game?.ownerId === playerId
}

/**
 * @param {?import('@tabulous/types').Player} player - checked player.
 * @returns whether this player is an admin or not.
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
 * @template Parameters
 * @param {string} gameId - loaded game id.
 * @param {import('@tabulous/types').Player} player - joining guest
 * @param {?Parameters} [parameters] - parameters values for this player, when joining for the first time.
 * @returns {Promise<?import('@tabulous/types').GameData|import('@tabulous/types').GameParameters<Parameters>>} the loaded game, its parameters, or null.
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
  const engineScript = await repositories.catalogItems.getEngineScript(
    maybeGame.kind
  )
  if (isPlayer(maybeGame, player.id)) {
    return { ...maybeGame, engineScript }
  }
  if (!isGuest(maybeGame, player?.id)) {
    return null
  }
  if (maybeGame.availableSeats <= 0) {
    throw new Error('no more available seats')
  }
  const game = /** @type {import('@tabulous/types').StartedGame}*/ (maybeGame)
  try {
    /** @type {?import('@tabulous/types').GameDescriptor} */
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
    reportReusedIds(savedGame)
    notifyAllPeers(savedGame)
    logger.debug({ ctx, res: serializeForLogs(savedGame) }, 'joined game')
    return { ...savedGame, engineScript }
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
 * @param {?import('@tabulous/types').Game} game - checked game.
 * @param {string} userId - user to check.
 * @returns whether this user is a guest or not.
 */
function isGuest(game, userId) {
  return (game?.guestIds ?? []).indexOf(userId) >= 0
}

/**
 * @template {Record<string, ?>} Parameters
 * @param {import('@tabulous/types').Schema<Parameters>} schema - JSONSchema to validate
 * @param {object} parameters - validated object
 * @returns a validation error string or undefined
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
 * @param {?import('@tabulous/types').GameDescriptor} args.descriptor - game descriptor.
 * @param {import('@tabulous/types').StartedGame} args.game - full game data.
 * @param {import('@tabulous/types').Player} args.guest - guest who is becoming a player.
 * @param {?{ color?: string }} args.parameters - parameters provided by the guest.
 * @returns enriched game data.
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
  const r = enrichAssets(
    await descriptor.addPlayer(game, guest, parameters ?? {})
  )
  return r
}

/**
 * Saves an existing game.
 * The operation will abort and return null when:
 * - the player does not own the game
 * @param {Partial<import('@tabulous/types').GameData>} game - saved game.
 * @param {string} playerId - saving playerId id.
 * @returns the saved game, or null.
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
    cameras: game.cameras ?? previous.cameras,
    history: game.history ?? previous.history
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
 * @returns updated game, or null
 */
export async function invite(gameId, guestIds, playerId) {
  const ctx = { playerId, gameId, guestIds }
  logger.trace({ ctx }, 'inviting to game')
  const guests = /** @type {import('@tabulous/types').Player[]} */ (
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
 * @param {import('@tabulous/types').Game} game - checked game.
 * @returns whether this user is already in players or guest of this game.
 */
function isGuestAlreadyPlaying(userId, { playerIds, guestIds }) {
  return playerIds.includes(userId) || guestIds.includes(userId)
}

/**
 * @param {string} guestId - checked guest id.
 * @param {import('@src/repositories/players').Friendship[]} friendships - current player existing relationships.
 * @returns whether this guest is a friend of the current player.
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
 * @returns updated game data.
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
 * @returns a list of games (could be empty).
 */
export async function listGames(playerId) {
  return (await repositories.games.listByPlayerId(playerId)).filter(Boolean)
}

/**
 * Updates game lists including a given player id. Usefull when updating a player's username.
 * @param {string} playerId - the player id which is triggering the update.
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
 * @returns the number of owned games.
 */
export async function countOwnGames(playerId, excludedGameIds = []) {
  return (await listGames(playerId)).reduce(
    (count, { id, ownerId }) =>
      count + (ownerId === playerId && !excludedGameIds.includes(id) ? 1 : 0),
    0
  )
}

/**
 * Sends a reloaded descriptor to all players current playing games of the given kind.
 * @param {string} kind - reloaded game kind.
 */
export async function reloadGames(kind) {
  await repositories.catalogItems.reload(kind)

  async function* listGames() {
    /** @type {Awaited<ReturnType<typeof repositories.games.list>>} */
    let page = { from: 0, size: 20, total: 1, results: [] }
    while (page.from < page.total) {
      page = await repositories.games.list(page)
      yield* page.results
      page.from += page.size
    }
  }

  /** @type {import('@tabulous/types').Game[]} */
  const updated = []
  for await (const game of listGames()) {
    if (game.kind === kind) {
      updated.push(game)
    }
  }
  if (updated.length) {
    gameKindUpdate$.next(updated)
  }
}

/**
 * @param {import('@tabulous/types').GameData|import('@tabulous/types').GameParameters<?>} game - serialized game
 * @returns important serialized fields
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
