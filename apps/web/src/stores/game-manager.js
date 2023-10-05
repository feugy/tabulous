// @ts-check
import * as graphQL from '@src/graphql'
import {
  clearThread,
  loadThread,
  serializeThread
} from '@src/stores/discussion'
import {
  runMutation,
  runQuery,
  runSubscription
} from '@src/stores/graphql-client'
import { notify } from '@src/stores/notifications'
import {
  closeChannels,
  connectWith,
  lastConnectedId,
  lastDisconnectedId,
  lastMessageReceived,
  lastMessageSent,
  openChannels,
  send
} from '@src/stores/peer-channels'
import { toastInfo } from '@src/stores/toaster'
import {
  buildPlayerColors,
  findPlayerColor,
  isLobby,
  makeLogger,
  sleep
} from '@src/utils'
import { findPlayerPreferences } from '@tabulous/game-utils'
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  filter,
  map,
  merge
} from 'rxjs'
import { get } from 'svelte/store'
// dynamically import ./game-engine which depends on
// This allows splitting production chunks and keep Babylonjs (1.6Mb uncompressed) on its own.

/**
 * @typedef {object} _Player
 * @property {boolean} playing - whether this player is currently playing.
 * @property {boolean} isHost - whether this player is hosting the current game.
 *
 * @typedef {import('@src/graphql').LightPlayer & ReturnType<typeof findPlayerPreferences> & _Player} PlayerWithPref
 */

/** @typedef {import('@src/graphql').Game & { selections?: import('@src/3d/engine').PlayerSelection[] }} GameWithSelections */

/**
 * @typedef {object} JoinGameArgs
 * @property {string} gameId - the loaded game id.
 * @property {import('@src/graphql').LightPlayer} player - the current authenticated user.
 * @property {import('@tabulous/types').TurnCredentials} turnCredentials - credentials used to log onto the TURN server.
 * @property {import('@src/types').JSONValue} [parameters] - user chosen parameters, if any.
 * @property {(game: ?import('@src/graphql').Game) => void} [onDeletion] - optional callback invoked when current game is deleted on server side.
 * @property {(game: import('@src/graphql').Game) => void} [onPromotion] - optional callback invoked when current lobby is promoted to full game.
 */

/**
 * @typedef {object} JoinGameContext
 * @property {import('@src/stores/game-engine')} gameEngine - lazy-loaded game engine store.
 * @property {string} gameId - joined game id.
 * @property {string} currentPlayerId - joining player id.
 * @property {JoinGameArgs['onDeletion']} onDeletion - optional callback invoked when current game is deleted on server side.
 * @property {JoinGameArgs['onPromotion']} onPromotion - optional callback invoked when current lobby is promoted to full game.
 */

const logger = makeLogger('game-manager')
const currentGame$ = new BehaviorSubject(
  /** @type {?import('@src/graphql').GameOrGameParameters} */ (null)
)
const hostId$ = new BehaviorSubject(/** @type {?string} */ (null))
const playingIds$ = new BehaviorSubject(/** @type {string[]} */ ([]))
/** @type {import('rxjs').Subscription[]} */
const currentGameSubscriptions = []
/** @type {?import('rxjs').Subscription} */
let listGamesSubscription = null
let delayOnLoad = () => {}
/** @type {Map<string, PlayerWithPref>} */
let playerById = new Map()
// cameras for all players
/** @type {import('@tabulous/types').CameraPosition[]} */
let cameras = []
// hands for all players
/** @type {import('@tabulous/types').Hand[]} */
let hands = []
// active selections for all players
/** @type {import('@src/3d/engine').PlayerSelection[]} */
let selections = []

/**
 * Emits the player current game, or undefined.
 */
export const currentGame = currentGame$.asObservable()

/**
 * Indicates whether a given game is different from the current game.
 * @param {?string} [gameId] - id of the tested game.
 */
export function isDifferentGame(gameId) {
  return currentGame$.value?.id !== gameId
}

/**
 * Emits the player current color.
 */
export const playerColor = combineLatest([currentGame$, playingIds$]).pipe(
  map(([game, playingIds]) => findPlayerColor(game, playingIds[0]))
)

/**
 * Emits a map of player in current game.
 */
export const gamePlayerById = merge(hostId$, playingIds$, currentGame$).pipe(
  map(() => {
    playerById = new Map()
    const game = currentGame$.value
    if (game) {
      for (const player of game.players ?? []) {
        playerById.set(player.id, {
          ...player,
          ...findPlayerPreferences(game.preferences, player.id),
          playing: playingIds$.value.includes(player.id),
          isHost: isCurrentHost(player.id)
        })
      }
    }
    return playerById
  })
)

/**
 * Lists all current games.
 */
export async function listGames() {
  logger.info('list current games')
  return runQuery(graphQL.listGames)
}

/**
 * Subscribes to current game list updates, to keep the list fresh.
 * @param {import('@src/graphql').LightGame[]} [currentGames] - current game list.
 * @returns an observable containing up-to-date current games.
 */
export function receiveGameListUpdates(currentGames) {
  if (listGamesSubscription) {
    listGamesSubscription.unsubscribe()
  }
  const currentGames$ = new BehaviorSubject(currentGames || [])
  listGamesSubscription = runSubscription(
    graphQL.receiveGameListUpdates
  ).subscribe(value => {
    const previous = currentGames$.value
    currentGames$.next(value)
    if (previous.length < value.length) {
      notify({ contentKey: 'labels.new-game-invite' })
    }
  })
  return currentGames$.asObservable()
}

/**
 * Creates a new game of a given kind on server, registering current player in it,
 * and receiving its id.
 * @param {string} [kind] - created game kind (omit to create a lobby).
 * @returns the created game data.
 */
export async function createGame(kind) {
  const game = await runMutation(graphQL.createGame, { kind })
  logger.info(
    game,
    `create new ${isLobby(game) ? 'lobby' : `${kind} game`} (${game.id})`
  )
  return game
}

/**
 * Deletes a game owned by current player, and refreshes the game list.
 * @async
 * @param {string} gameId - the deleted game id.
 */
export async function deleteGame(gameId) {
  logger.info({ gameId }, `deletes game (${gameId})`)
  await runMutation(graphQL.deleteGame, { gameId })
}

/**
 * Invites another player to a given game.
 * Does not alter the current game: instead game updates should come from server or host.
 * @param {string} gameId - the shared game id.
 * @param {...string} playerIds - the invited player id(s).
 */
export async function invite(gameId, ...playerIds) {
  logger.info(
    { gameId, playerIds },
    `invite player ${playerIds.join(', ')} to game ${gameId}`
  )
  await runMutation(graphQL.invite, { gameId, playerIds })
}

/**
 * Licks a game's guest (or a lobby's player).
 * Does not alter the current game: instead game updates should come from server or host.
 * @param {string} gameId - the game id.
 * @param {string} kickedId - the kicked guest/player id.
 */
export async function kick(gameId, kickedId) {
  logger.info(
    { gameId, kickedId },
    `kick guest/player ${kickedId} from lobby/game ${gameId}`
  )
  await runMutation(graphQL.kick, { gameId, playerId: kickedId })
}

/**
 * Promotes a lobby into a full game,
 * @param {string} gameId - the promoted game id.
 * @param {string} kind - promoted game kind.
 */
export async function promoteGame(gameId, kind) {
  logger.info(
    { gameId, kind },
    `promotes lobby (${gameId}) into a ${kind} game`
  )
  return await runMutation(graphQL.promoteGame, { gameId, kind })
}

/**
 * Joins an existing game, loading it from the server.
 * If server returns required paremters, navigates to the relevant page.
 * Otherwise, loads the data into the provided 3D engine.
 * If current player is the only connected player, it takes the host role, responsible for saving
 * the game and sharing it with new players.
 * If other players are connected, waits at most 30s to receive the game data from game host.
 * Resolves when the game data has been received (either as host or regular peer).
 * @param {JoinGameArgs} args - operation arguments.
 */
export async function joinGame({
  gameId,
  player: currentPlayer,
  turnCredentials,
  parameters,
  onDeletion,
  onPromotion
}) {
  const currentPlayerId = currentPlayer.id

  /* c8 ignore start */
  if (!delayOnLoad && import.meta.hot) {
    const delayKey = 'joinGameDelay'

    delayOnLoad = async () => {
      const delay = sessionStorage.getItem(delayKey)
      if (delay) {
        await sleep(+delay)
        sessionStorage.removeItem(delayKey)
      }
    }

    import.meta.hot.on('vite:beforeUpdate', ({ updates }) => {
      if (updates.some(({ path }) => path.includes('Game.svelte'))) {
        if (hostId$.value && !isCurrentHost(currentPlayerId)) {
          console.warn(
            'Since there are multiple connected players, HMR is slightly delayed to let host reconnect'
          )
          sessionStorage.setItem(delayKey, '3000')
        }
      }
    })
  }
  await delayOnLoad()
  /* c8 ignore stop */

  const needPeerConnection = isDifferentGame(gameId)

  if (needPeerConnection) {
    await leaveGame(currentPlayer)
  } else {
    unsubscribeCurrentGame()
  }

  const game = await runMutation(graphQL.joinGame, {
    gameId,
    parameters: parameters ? JSON.stringify(parameters) : undefined
  })
  if (!game) {
    logger.info({ gameId }, `trying to join unexisting game ${gameId}`)
    return null
  }
  logger.info(
    { game },
    `entering ${isLobby(game) ? 'lobby' : 'game'} ${gameId}`
  )

  if (needPeerConnection) {
    await openChannels(currentPlayer, turnCredentials, gameId)
    playingIds$.next([currentPlayerId])
  }

  const gameEngine = await import('./game-engine')
  const engine = /** @type {import('@babylonjs/core').Engine} */ (
    get(gameEngine.engine)
  )

  currentGame$.next(game)
  currentGameSubscriptions.push(
    ...subscribePeerStatusesAndGameUpdates({
      gameEngine,
      gameId,
      currentPlayerId,
      onDeletion,
      onPromotion
    })
  )

  if (needPeerConnection) {
    const peers = (game.players ?? []).filter(
      ({ id, currentGameId }) =>
        id !== currentPlayerId && currentGameId === game.id
    )
    logger.info({ peers }, `connecting to other players`)
    for (const peer of peers) {
      connectWith(peer.id, turnCredentials)
    }
  }
  const isHost = isNextHost(currentPlayerId)
  if (isGameParameter(game)) {
    if (isHost) {
      currentGameSubscriptions.push(
        ...takeHostRole(gameEngine, gameId, currentPlayerId, false)
      )
    }
    return game
  }
  await load(engine, game, currentPlayerId, true)
  if (isHost) {
    currentGameSubscriptions.push(
      ...takeHostRole(gameEngine, gameId, currentPlayerId)
    )
  } else {
    currentGameSubscriptions.push(
      gameEngine.cameraSaves.subscribe(shareCameras(currentPlayerId)),
      gameEngine.handMeshes.subscribe(shareHand(currentPlayerId)),
      lastMessageReceived
        .pipe(filter(({ data }) => data?.type === 'game-sync'))
        .subscribe(({ data, playerId }) => {
          if (!isCurrentHost(playerId)) {
            hostId$.next(playerId)
            logger.info({ playerId }, `updating host to ${playerId}`)
          }
          load(engine, data, currentPlayerId)
        })
    )
  }
  return game
}

/**
 * Leaves current game, trigering a last save when current player is the host.
 * Shuts down peer channels.
 * Does nothing without any current game.
 * @param {Pick<PlayerWithPref, 'id'>} player - the current player details.
 */
export async function leaveGame({ id: currentPlayerId }) {
  const game = currentGame$.value
  if (!game) {
    return
  }
  const engine = /** @type {import('@babylonjs/core').Engine} */ (
    get((await import('./game-engine')).engine)
  )
  const { id: gameId } = game
  if (isCurrentHost(currentPlayerId)) {
    logger.info({ gameId, currentPlayerId }, `persisting game before leaving`)
    runMutation(graphQL.saveGame, {
      game: serializeGame(engine, currentPlayerId)
    })
  }
  unsubscribeCurrentGame()
  closeChannels()
  currentGame$.next(null)
  hostId$.next(null)
  playingIds$.next([])
  cameras = []
  hands = []
  selections = []
  clearThread()
}

async function load(
  /** @type {import('@babylonjs/core').Engine} */ engine,
  /** @type {import('@src/graphql').GameOrGameParameters} */ game,
  /** @type {string} */ playerId,
  firstLoad = false
) {
  const { loadCameraSaves } = await import('./game-engine')
  currentGame$.next(game)
  hands = ('hands' in game ? game.hands : null) ?? []
  cameras = ('cameras' in game ? game.cameras : null) ?? []
  selections =
    ('selections' in game
      ? /** @type {GameWithSelections} */ (game).selections
      : null) ?? []
  if ('messages' in game && game.messages) {
    loadThread(game.messages)
  }
  if (cameras.length && firstLoad) {
    const playerCameras = cameras
      .filter(save => save.playerId === playerId)
      .sort((a, b) => a.index - b.index)
    if (playerCameras.length) {
      loadCameraSaves(playerCameras)
    }
  }
  if (
    engine &&
    (game.players ?? []).find(({ id }) => id === playerId)?.isGuest === false
  ) {
    await engine.load(
      /** @type {import('@src/graphql').Game} */ (game),
      {
        playerId,
        preference: findPlayerPreferences(game.preferences, playerId),
        colorByPlayerId: buildPlayerColors(game)
      },
      firstLoad
    )
  }
}

function mergeCameras(
  /** @type {{ playerId: string, cameras: import('@src/3d/managers').CameraPosition[] }} */ {
    playerId,
    cameras: playerCameras
  }
) {
  logger.info(
    { playerId, cameras, playerCameras },
    `merging cameras for ${playerId}`
  )
  cameras = [
    // keeps saves from other players as-is
    ...cameras.filter(save => save.playerId !== playerId),
    // enriches player saves with their id and index
    ...playerCameras.map((save, index) => ({ ...save, playerId, index }))
  ]
}

function saveCameras(/** @type {string} */ gameId) {
  logger.info({ gameId, cameras }, `persisting game cameras`)
  runMutation(graphQL.saveGame, { game: { id: gameId, cameras } })
}

function mergeHands(
  /** @type {{ playerId: String, meshes?: import('@tabulous/types').Mesh[] }} */ {
    playerId,
    meshes = []
  }
) {
  hands = [
    ...hands.filter(hand => hand.playerId !== playerId),
    { playerId, meshes }
  ]
  return hands
}

function saveHands(/** @type {string} */ gameId) {
  logger.info({ gameId, hands }, `persisting player hands`)
  runMutation(graphQL.saveGame, { game: { id: gameId, hands } })
}

function mergeSelections(
  /** @type {import('@src/3d/engine').PlayerSelection} */ {
    playerId,
    selectedIds
  }
) {
  selections = [
    ...selections.filter(selection => selection.playerId !== playerId),
    { playerId, selectedIds }
  ]
  return selections
}

function takeHostRole(
  /** @type {import('@src/stores/game-engine')} */
  {
    engine: engine$,
    action,
    cameraSaves,
    handMeshes,
    remoteSelection,
    selectedMeshes
  },
  /** @type {string} */ gameId,
  /** @type {string} */ currentPlayerId,
  shouldShareGame = true
) {
  const game = currentGame$.value
  const engine = /** @type {import('@babylonjs/core').Engine} */ (get(engine$))
  logger.info({ gameId, game }, `taking game host role`)
  hostId$.next(currentPlayerId)
  if (shouldShareGame && !isLobby(game)) {
    shareGame(engine, currentPlayerId)
  }

  return [
    // save scene
    action
      .pipe(
        filter(({ fromHand }) => !fromHand),
        debounceTime(1000)
      )
      .subscribe(action => {
        logger.info({ gameId, action }, `persisting game scene on action`)
        runMutation(graphQL.saveGame, {
          game: shareGame(engine, currentPlayerId)
        })
      }),
    // save discussion thread
    merge(lastMessageSent, lastMessageReceived)
      .pipe(
        filter(({ data }) => data?.type === 'message'),
        debounceTime(1000)
      )
      .subscribe(() => {
        logger.info({ gameId }, `persisting game thread`)
        runMutation(graphQL.saveGame, {
          game: { id: gameId, messages: serializeThread() }
        })
      }),
    // save player hands
    merge(
      lastMessageReceived.pipe(filter(({ data }) => data?.type === 'saveHand')),
      handMeshes.pipe(
        map(meshes => ({ data: { playerId: currentPlayerId, meshes } }))
      )
    ).subscribe(
      (
        /** @type {{ data: { playerId: string, meshes?: import('@tabulous/types').Mesh[]} }} */ {
          data
        }
      ) => {
        mergeHands(data)
        saveHands(gameId)
      }
    ),
    // save camera positions
    merge(
      lastMessageReceived.pipe(
        filter(({ data }) => data?.type === 'saveCameras')
      ),
      cameraSaves.pipe(
        map(cameras => ({ data: { playerId: currentPlayerId, cameras } }))
      )
    ).subscribe(({ data }) => {
      mergeCameras(data)
      saveCameras(gameId)
    }),
    // keeps active selections
    merge(
      selectedMeshes.pipe(
        map(selected => ({
          playerId: currentPlayerId,
          selectedIds: [...selected].map(({ id }) => id)
        }))
      ),
      remoteSelection
    ).subscribe(mergeSelections)
  ]
}

function subscribePeerStatusesAndGameUpdates(
  /** @type {JoinGameContext} */ params
) {
  const { gameId } = params
  return [
    runSubscription(graphQL.receiveGameUpdates, { gameId }).subscribe(
      handleServerUpdate(params)
    ),
    lastConnectedId.subscribe(handlePeerConnection(params)),
    lastDisconnectedId.subscribe(handlePeerDisconnection(params))
  ]
}

function handleServerUpdate(
  /** @type {JoinGameContext} */ {
    gameEngine,
    currentPlayerId,
    onDeletion,
    onPromotion
  }
) {
  return async function (
    /** @type {import('@src/graphql').GameOrGameParameters} */ game
  ) {
    const currentGame = /** @type {?import('@src/graphql').Game} */ (
      currentGame$.value
    )
    const wasLobby = isLobby(currentGame)
    if (!game) {
      await leaveGame({ id: currentPlayerId })
      onDeletion?.(currentGame)
    } else {
      logger.debug(
        { gameId: game.id, currentPlayerId, wasLobby, game },
        'loading game update from server'
      )
      await load(
        /** @type {import('@babylonjs/core').Engine} */ (
          get(gameEngine.engine)
        ),
        game,
        currentPlayerId,
        false
      )
      if (wasLobby && !isLobby(game)) {
        onPromotion?.(/** @type {import('@src/graphql').Game} */ (game))
      }
    }
  }
}

function serializeGame(
  /** @type {import('@babylonjs/core').Engine} */ engine,
  /** @type {string} */ currentPlayerId
) {
  const { meshes, handMeshes, history } =
    (isLobby(currentGame$.value) ? null : engine?.serialize()) ?? {}
  return {
    id: /** @type {import('@src/graphql').GameOrGameParameters} */ (
      currentGame$.value
    ).id,
    meshes,
    hands: mergeHands({ playerId: currentPlayerId, meshes: handMeshes }),
    messages: serializeThread(),
    cameras,
    history
  }
}

function shareGame(
  /** @type {import('@babylonjs/core').Engine} */ engine,
  /** @type {string} */ currentPlayerId,
  /** @type {string} */ peerId
) {
  const { id: gameId, ...otherGameData } =
    /** @type {import('@src/graphql').Game} */ (currentGame$.value)
  logger.info(
    { gameId },
    `sending game data ${gameId} to peer${peerId ? ` ${peerId}` : 's'}`
  )
  const game = serializeGame(engine, currentPlayerId)
  send({ type: 'game-sync', ...otherGameData, ...game, selections }, peerId)
  return game
}

function unsubscribeCurrentGame() {
  logger.info(`closing all subscriptions`)
  for (const subscription of currentGameSubscriptions) {
    subscription.unsubscribe()
  }
  currentGameSubscriptions.splice(0, currentGameSubscriptions.length)
}

function handlePeerConnection(
  /** @type {JoinGameContext} */ { gameEngine, currentPlayerId }
) {
  return async function (/** @type {string} */ playerId) {
    playingIds$.next([...playingIds$.value, playerId])
    const game = /** @type {import('@src/graphql').GameOrGameParameters} */ (
      currentGame$.value
    )
    if (!(game.players ?? []).some(({ id }) => id === playerId)) {
      const { players } = await runMutation(graphQL.getGamePlayers, game)
      currentGame$.next({ ...game, players })
    }
    if (isCurrentHost(currentPlayerId)) {
      shareGame(
        /** @type {import('@babylonjs/core').Engine} */ (
          get(gameEngine.engine)
        ),
        currentPlayerId,
        playerId
      )
    }
    toastInfo({
      icon: 'person_add_alt_1',
      contentKey: isLobby(game)
        ? 'labels.player-joined-lobby'
        : 'labels.player-joined-game',
      player: playerById.get(playerId) ?? {}
    })
  }
}

function handlePeerDisconnection(/** @type {JoinGameContext} */ params) {
  const { currentPlayerId, gameEngine } = params
  return function (/** @type {string} */ playerId) {
    const game = /** @type {import('@src/graphql').GameOrGameParameters} */ (
      currentGame$.value
    )
    toastInfo({
      icon: 'person_remove',
      contentKey: isLobby(game)
        ? 'labels.player-left-lobby'
        : 'labels.player-left-game',
      player: playerById.get(playerId) ?? {}
    })
    const playingIds = playingIds$.value.filter(id => id !== playerId)
    playingIds$.next(playingIds)
    if (isCurrentHost(playerId) && isNextHost(currentPlayerId, playingIds)) {
      // TODO do not unsubscribe subscribePeerStatusesAndGameUpdates, and only others before taking host role.
      unsubscribeCurrentGame()
      currentGameSubscriptions.push(
        ...subscribePeerStatusesAndGameUpdates(params),
        ...takeHostRole(gameEngine, game.id, currentPlayerId)
      )
    }
  }
}

function shareCameras(/** @type {string} */ currentPlayerId) {
  return function (
    /** @type {import('@src/3d/managers').CameraPosition[]} */ cameras
  ) {
    logger.info({ cameras }, `sharing camera saves with peers`)
    send({ type: 'saveCameras', cameras, playerId: currentPlayerId })
  }
}

function shareHand(/** @type {string} */ currentPlayerId) {
  return function (
    /** @type {import('@tabulous/types').Mesh[]|undefined} */ meshes
  ) {
    logger.info({ meshes }, `sharing hand with peers`)
    send({ type: 'saveHand', meshes, playerId: currentPlayerId })
  }
}

function isNextHost(
  /** @type {string} */ playerId,
  /** @type {string[]} */ connectedIds
) {
  const { id, players } =
    /** @type {Required<Pick<import('@src/graphql').Game, 'id'|'players'>>} */ (
      currentGame$.value
    )
  const connectedPlayers = players
    .filter(({ isGuest }) => !isGuest)
    .map(player => ({
      ...player,
      playing: connectedIds
        ? connectedIds.includes(player.id)
        : player.currentGameId === id
    }))
  const firstPlaying = connectedPlayers.find(({ playing }) => playing)
  // when no one is playing yet, firstPlaying is undefined.
  // when multiple are playing, and the host left, first playing may be current player.
  return (
    (connectedPlayers.length && !firstPlaying) || firstPlaying?.id === playerId
  )
}

function isCurrentHost(/** @type {string} */ playerId) {
  return playerId === hostId$.value
}

function isGameParameter(
  /** @type {import('@src/graphql').GameOrGameParameters} */ game
) {
  return 'schema' in game && Boolean(game.schema)
}
