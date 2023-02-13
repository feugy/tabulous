import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  filter,
  map,
  merge
} from 'rxjs'

import * as graphQL from '../graphql'
import {
  buildPlayerColors,
  findPlayerColor,
  findPlayerPreferences,
  isLobby,
  makeLogger,
  sleep
} from '../utils'
import { clearThread, loadThread, serializeThread } from './discussion'
import {
  action,
  cameraSaves as cameraSaves$,
  engine as engine$,
  handMeshes as handMeshes$,
  loadCameraSaves,
  remoteSelection,
  selectedMeshes
} from './game-engine'
import { runMutation, runQuery, runSubscription } from './graphql-client'
import { notify } from './notifications'
import {
  closeChannels,
  connectWith,
  lastConnectedId,
  lastDisconnectedId,
  lastMessageReceived,
  lastMessageSent,
  openChannels,
  send
} from './peer-channels'
import { toastInfo } from './toaster'

/** @typedef {import('../graphql').lightPlayer} Player */
/** @typedef {import('../graphql').gameData} Game */

const logger = makeLogger('game-manager')
const currentGame$ = new BehaviorSubject()
const hostId$ = new BehaviorSubject(null)
const playingIds$ = new BehaviorSubject([])
const currentGameSubscriptions = []
let listGamesSubscription = null
let delayOnLoad = () => {}
let playerById = new Map()
let engine
// cameras for all players
let cameras = []
// hands for all players
let hands = []
// active selections for all players
let selections = []

engine$.subscribe(value => (engine = value))

/**
 * Emits the player current game, or undefined.
 * @type {Observable<object>} TODO
 */
export const currentGame = currentGame$.asObservable()

/**
 * Indicates whether a given game is different from the current game.
 * @param {string} gameId? - id of the tested game.
 * @returns {boolean} true when the two games have the same id.
 */
export function isDifferentGame(gameId) {
  return currentGame$.value?.id !== gameId
}

/**
 * Emits the player current color.
 * @type {Observable<string>}
 */
export const playerColor = combineLatest([currentGame$, playingIds$]).pipe(
  map(([game, playingIds]) => findPlayerColor(game, playingIds[0]))
)

/**
 * Emits a map of player in current game.
 * @type {Observable<Map<string, Player>>}
 */
export const gamePlayerById = merge(hostId$, playingIds$, currentGame$).pipe(
  map(() => {
    playerById = new Map()
    const game = currentGame$.value
    if (game) {
      // we don't want currentGameId in gamePlayerById map
      // eslint-disable-next-line no-unused-vars
      for (const { id, currentGameId, ...player } of game.players) {
        playerById.set(id, {
          id,
          ...player,
          ...findPlayerPreferences(game, id),
          playing: playingIds$.value.includes(id),
          isHost: isCurrentHost(id)
        })
      }
    }
    return playerById
  })
)

/**
 * Lists all current games.
 * @returns {Promise<Game[]>} a list of current games for the authenticated user.
 */
export async function listGames() {
  logger.info('list current games')
  return runQuery(graphQL.listGames)
}

/**
 * Subscribes to current game list updates, to keep the list fresh.
 * @param {Game[]} currentGames - current game list.
 * @returns {Observable<Game[]>} an observable containing up-to-date current games.
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
 * @param {string} kind - created game kind.
 * @returns {Promise<Game>} the created game data.
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
 * Promotes a lobby into a full game,
 * @param {string} gameId - the promoted game id.
 * @param {string} kind - promoted game kind.
 * @returns {Promise<Game>} the created game id.
 */
export async function promoteGame(gameId, kind) {
  logger.info(
    { gameId, kind },
    `promotes lobby (${gameId}) into a ${kind} game`
  )
  return await runMutation(graphQL.promoteGame, { gameId, kind })
}

/**
 * @typedef {object} joinGameArgs
 * @property {string} gameId - the loaded game id.
 * @property {object} player - the session details.
 * @property {object} turnCredentials - credentials used to log onto the TURN server.
 * @property {object} parameters? - user chosen parameters, if any.
 * @property {(game: Game) => void} onDeletion? - optional callback invoked when current game is deleted on server side.
 * @property {(game: Game) => void} onPromotion? - optional callback invoked when current lobby is promoted to full game.
 */

/**
 * Joins an existing game, loading it from the server.
 * If server returns required paremters, navigates to the relevant page.
 * Otherwise, loads the data into the provided 3D engine.
 * If current player is the only connected player, it takes the host role, responsible for saving
 * the game and sharing it with new players.
 * If other players are connected, waits at most 30s to receive the game data from game host.
 * Resolves when the game data has been received (either as host or regular peer).
 * @param {joinGameArgs} args - operation arguments.
 * @returns {Promise<Game>} - game parameters or game data
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
          sessionStorage.setItem(delayKey, 3000)
        }
      }
    })
  }
  await delayOnLoad()
  /* c8 ignore stop */

  const needPeerConnection = isDifferentGame(gameId)

  if (needPeerConnection) {
    leaveGame(currentPlayer)
  } else {
    unsubscribeCurrentGame()
  }

  let game = await runMutation(graphQL.joinGame, {
    gameId,
    parameters: parameters ? JSON.stringify(parameters) : undefined
  })
  logger.info(
    { game },
    `entering ${isLobby(game) ? 'lobby' : 'game'} ${gameId}`
  )

  if (needPeerConnection) {
    await openChannels(currentPlayer, turnCredentials, gameId)
    playingIds$.next([currentPlayerId])
  }

  currentGame$.next(game)
  currentGameSubscriptions.push(
    ...subscribePeerStatusesAndGameUpdates({
      gameId,
      currentPlayerId,
      onDeletion,
      onPromotion
    })
  )

  if (needPeerConnection) {
    const peers = game.players.filter(
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
        ...takeHostRole(gameId, currentPlayerId, false)
      )
    }
    return game
  }
  const loadComplete = load(game, currentPlayerId, true)
  if (isHost) {
    currentGameSubscriptions.push(...takeHostRole(gameId, currentPlayerId))
  } else {
    currentGameSubscriptions.push(
      cameraSaves$.subscribe(shareCameras(currentPlayerId)),
      handMeshes$.subscribe(shareHand(currentPlayerId)),
      lastMessageReceived
        .pipe(filter(({ data }) => data?.type === 'game-sync'))
        .subscribe(({ data, playerId }) => {
          logger.info(
            { game: data, playerId },
            `loading game data (${data.id})`
          )
          if (!isCurrentHost(playerId)) {
            hostId$.next(playerId)
          }
        })
    )
  }
  await loadComplete
  return game
}

/**
 * Leaves current game, trigering a last save when current player is the host.
 * Shuts down peer channels.
 * Does nothing without any current game.
 * @param {object} player - the current player details.
 */
export function leaveGame({ id: currentPlayerId }) {
  const game = currentGame$.value
  if (!game) {
    return
  }
  const { id: gameId } = game
  if (isCurrentHost(currentPlayerId)) {
    logger.info({ gameId, currentPlayerId }, `persisting game before leaving`)
    runMutation(graphQL.saveGame, { game: serializeGame(currentPlayerId) })
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

async function load(game, currentPlayerId, firstLoad) {
  currentGame$.next(game)
  hands = game.hands ?? []
  cameras = game.cameras ?? []
  selections = game.selections ?? []
  if (game.messages) {
    loadThread(game.messages)
  }
  if (cameras.length && firstLoad) {
    const playerCameras = cameras
      .filter(save => save.playerId === currentPlayerId)
      .sort((a, b) => a.index - b.index)
    if (playerCameras.length) {
      loadCameraSaves(playerCameras)
    }
  }
  if (
    engine &&
    game.players.find(({ id }) => id === currentPlayerId)?.isGuest === false
  ) {
    await engine.load(game, currentPlayerId, buildPlayerColors(game), firstLoad)
  }
}

function mergeCameras({ playerId, cameras: playerCameras }) {
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

function saveCameras(gameId) {
  logger.info({ gameId, cameras }, `persisting game cameras`)
  runMutation(graphQL.saveGame, { game: { id: gameId, cameras } })
}

function mergeHands({ playerId, meshes = [] }) {
  hands = [
    ...hands.filter(hand => hand.playerId !== playerId),
    { playerId, meshes }
  ]
  return hands
}

function saveHands(gameId) {
  logger.info({ gameId, hands }, `persisting player hands`)
  runMutation(graphQL.saveGame, { game: { id: gameId, hands } })
}

function mergeSelections({ playerId, selectedIds }) {
  selections = [
    ...selections.filter(selection => selection.playerId !== playerId),
    { playerId, selectedIds }
  ]
  return selections
}

function takeHostRole(gameId, currentPlayerId, shouldShareGame = true) {
  const game = currentGame$.value
  logger.info({ gameId, game }, `taking game host role`)
  hostId$.next(currentPlayerId)
  if (shouldShareGame && !isLobby(game)) {
    shareGame(currentPlayerId)
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
        runMutation(graphQL.saveGame, { game: shareGame(currentPlayerId) })
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
      handMeshes$.pipe(
        map(meshes => ({ data: { playerId: currentPlayerId, meshes } }))
      )
    ).subscribe(({ data }) => {
      mergeHands(data)
      saveHands(gameId)
    }),
    // save camera positions
    merge(
      lastMessageReceived.pipe(
        filter(({ data }) => data?.type === 'saveCameras')
      ),
      cameraSaves$.pipe(
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

function subscribePeerStatusesAndGameUpdates(params) {
  const { gameId, currentPlayerId, onDeletion, onPromotion } = params
  return [
    runSubscription(graphQL.receiveGameUpdates, { gameId }).subscribe(
      handleServerUpdate(currentPlayerId, onDeletion, onPromotion)
    ),
    lastConnectedId.subscribe(handlePeerConnection(params)),
    lastDisconnectedId.subscribe(handlePeerDisconnection(params))
  ]
}

function handleServerUpdate(currentPlayerId, onDeletion, onPromotion) {
  return async function (game) {
    const wasLobby = isLobby(currentGame$.value)
    if (!game) {
      leaveGame({ id: currentPlayerId })
      onDeletion?.()
    } else {
      logger.debug(
        { gameId: game.id, currentPlayerId, wasLobby, game },
        'loading game update from server'
      )
      await load(game, currentPlayerId, false)
      if (wasLobby && !isLobby(game)) {
        onPromotion?.(game)
      }
    }
  }
}

function serializeGame(currentPlayerId) {
  const { meshes, handMeshes } =
    (!isLobby(currentGame$.value) && engine?.serialize()) ?? {}
  return {
    id: currentGame$.value.id,
    meshes,
    hands: mergeHands({ playerId: currentPlayerId, meshes: handMeshes }),
    messages: serializeThread(),
    cameras
  }
}

function shareGame(currentPlayerId, peerId) {
  const { id: gameId, ...otherGameData } = currentGame$.value
  logger.info(
    { gameId },
    `sending game data ${gameId} to peer${peerId ? ` ${peerId}` : 's'}`
  )
  const game = serializeGame(currentPlayerId)
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

function handlePeerConnection({ currentPlayerId }) {
  return async function (playerId) {
    playingIds$.next([...playingIds$.value, playerId])
    const game = currentGame$.value
    if (!game.players.some(({ id }) => id === playerId)) {
      const { players } = await runMutation(graphQL.getGamePlayers, game)
      currentGame$.next({ ...game, players })
    }
    if (isCurrentHost(currentPlayerId)) {
      shareGame(currentPlayerId, playerId)
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

function handlePeerDisconnection(params) {
  const { currentPlayerId } = params
  return function (playerId) {
    const game = currentGame$.value
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
      unsubscribeCurrentGame()
      currentGameSubscriptions.push(
        ...subscribePeerStatusesAndGameUpdates(params),
        ...takeHostRole(currentGame$.value.id, currentPlayerId)
      )
    }
  }
}

function shareCameras(currentPlayerId) {
  return function (cameras) {
    logger.info({ cameras }, `sharing camera saves with peers`)
    send({ type: 'saveCameras', cameras, playerId: currentPlayerId })
  }
}

function shareHand(currentPlayerId) {
  return function (meshes) {
    logger.info({ meshes }, `sharing hand with peers`)
    send({ type: 'saveHand', meshes, playerId: currentPlayerId })
  }
}

function isNextHost(playerId, connectedIds) {
  const { id, players } = currentGame$.value
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

function isCurrentHost(playerId) {
  return playerId === hostId$.value
}

function isGameParameter(game) {
  return Boolean(game.schemaString)
}
