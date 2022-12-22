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

// when joining game with connected peers, delay during which we expect to receive the game data
const gameReceptionDelay = 30000
const logger = makeLogger('game-manager')
const currentGame$ = new BehaviorSubject()
const hostId$ = new BehaviorSubject(null)
const playingIds$ = new BehaviorSubject([])
const currentGameSubscriptions = []
let listGamesSubscription = null
let delayOnLoad = () => {}
let playerById = new Map()
let engine
// skips saving camera positions after loading them from game data
let skipSharingCamera = false
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
 * Emits the player current color.
 * @type {Observable<string>}
 */
export const playerColor = combineLatest([currentGame$, playingIds$]).pipe(
  map(([game, playingIds]) => findPlayerColor(game, playingIds[0]))
)

/**
 * Emits a map of player in current game.
 * @type {Observable<Map<string, import('../graphql').Player>>}
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
          isHost: hostId$.value === id
        })
      }
    }
    return playerById
  })
)

/**
 * Lists all current games.
 * @returns {Promise<import('../graphql').Game[]>} a list of current games for the authenticated user.
 */
export async function listGames() {
  logger.info('list current games')
  return runQuery(graphQL.listGames)
}

/**
 * Subscribes to current game list updates, to keep the list fresh.
 * @param {import('../graphql').Game[]} currentGames - current game list.
 * @returns {Observable<import('../graphql').Game[]>} an observable containing up-to-date current games.
 */
export function receiveGameListUpdates(currentGames) {
  if (listGamesSubscription) {
    listGamesSubscription.unsubscribe()
  }
  const currentGames$ = new BehaviorSubject(currentGames || [])
  listGamesSubscription = runSubscription(
    graphQL.receiveGameListUpdates
  ).subscribe(currentGames$)
  return currentGames$.asObservable()
}

/**
 * Creates a new game of a given kind on server, registering current player in it,
 * and receiving its id.
 * @async
 * @param {string} kind - created game kind.
 * @returns {string} the created game id.
 */
export async function createGame(kind) {
  const game = await runMutation(graphQL.createGame, { kind })
  logger.info(game, `create new ${kind} game (${game.id})`)
  return game.id
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
 * @async
 * @param {string} gameId - the shared game id.
 * @param {string} playerId - the invited player id.
 * @returns {boolean} true when guest was invited.
 */
export async function invite(gameId, playerId) {
  logger.info(
    { gameId, playerId },
    `invite player ${playerId} to game ${gameId}`
  )
  const game = await runMutation(graphQL.invite, { gameId, playerId })
  if (!game) {
    return false
  }
  return true
}

/**
 * Join an existing game, loading it from the server.
 * If server returns required paremters, navigates to the relevant page.
 * Otherwise, loads the data into the provided 3D engine.
 * If current player is the only connected player, it takes the host role, responsible for saving
 * the game and sharing it with new players.
 * If other players are connected, waits at most 30s to receive the game data from game host.
 * Resolves when the game data has been received (either as host or regular peer).
 * @param {string} gameId - the loaded game id.
 * @param {object} session - the session details.
 * @param {object} [parameters] - user chosen parameters, if any.
 * @returns {Promise<GameParameters|null>} - game data, required parameters or null
 */
export async function joinGame(
  gameId,
  { player: currentPlayer, turnCredentials },
  parameters
) {
  if (!engine) {
    logger.warn(
      { gameId },
      `fail loading game ${gameId} as there are no current engine yet`
    )
    return null
  }

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
        if (hostId$.value && hostId$.value !== currentPlayerId) {
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
  logger.info({ gameId }, `entering game ${gameId}`)

  const needPeerConnection = isDifferentGame(gameId)

  if (needPeerConnection) {
    reset()
    engine.onDisposeObservable.addOnce(reset)
  } else {
    unsubscribeCurrentGame()
  }

  let game = await runMutation(graphQL.joinGame, {
    gameId,
    parameters: parameters ? JSON.stringify(parameters) : undefined
  })

  if (needPeerConnection) {
    await openChannels(currentPlayer, turnCredentials, gameId)
    playingIds$.next([currentPlayerId])
  }

  currentGame$.next(game)
  currentGameSubscriptions.push(
    lastConnectedId.subscribe(handlePeerConnection(currentPlayerId)),
    lastDisconnectedId.subscribe(handlePeerDisconnection(currentPlayerId))
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
  if (isHost) {
    const loadComplete = load(game, currentPlayerId, true)
    currentGameSubscriptions.push(...takeHostRole(gameId, currentPlayerId))
    await loadComplete
    return null
  }
  return new Promise((resolve, reject) => {
    const gameReceptionTimeout = setTimeout(() => {
      const error = new Error(
        `No game data after ${Math.floor(gameReceptionDelay / 1000)}s`
      )
      logger.error(error.message)
      unsubscribeCurrentGame()
      closeChannels()
      reject(error)
    }, gameReceptionDelay)

    let isFirstLoad = true
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
          if (hostId$.value !== playerId) {
            hostId$.next(playerId)
          }
          load(data, currentPlayerId, isFirstLoad)
          if (isFirstLoad) {
            clearTimeout(gameReceptionTimeout)
            resolve()
          }
          isFirstLoad = false
        })
    )
  })
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
      skipSharingCamera = true
      loadCameraSaves(playerCameras)
    }
  }
  await engine.load(game, currentPlayerId, buildPlayerColors(game), firstLoad)
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

function mergeHands({ playerId, meshes }) {
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
  logger.info({ gameId }, `taking game host role`)
  hostId$.next(currentPlayerId)
  if (shouldShareGame) {
    shareGame(currentPlayerId)
  }

  engine.onBeforeDisposeObservable.addOnce(() => {
    logger.info(
      { gameId, currentPlayerId },
      `persisting game before disposing engine`
    )
    runMutation(graphQL.saveGame, { game: serializeGame(currentPlayerId) })
  })
  return [
    runSubscription(graphQL.receiveGameUpdates, { gameId }).subscribe(
      handleServerUpdate(currentPlayerId)
    ),
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

function handleServerUpdate(currentPlayerId) {
  return async function (game) {
    await load(game, currentPlayerId, false)
    shareGame(currentPlayerId)
  }
}

function serializeGame(currentPlayerId) {
  const { handMeshes, meshes } = engine.serialize()
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

function handlePeerConnection(currentPlayerId) {
  return async function (playerId) {
    playingIds$.next([...playingIds$.value, playerId])
    const game = currentGame$.value
    if (!game.players.some(({ id }) => id === playerId)) {
      const { players } = await runMutation(graphQL.getGamePlayers, game)
      currentGame$.next({ ...game, players })
    }
    if (currentPlayerId === hostId$.value) {
      shareGame(currentPlayerId, playerId)
    }
    toastInfo({
      icon: 'person_add_alt_1',
      contentKey: 'labels.player-joined',
      player: playerById.get(playerId) ?? {}
    })
  }
}

function handlePeerDisconnection(currentPlayerId) {
  return function (playerId) {
    toastInfo({
      icon: 'person_remove',
      contentKey: 'labels.player-left',
      player: playerById.get(playerId) ?? {}
    })
    const playingIds = playingIds$.value.filter(id => id !== playerId)
    playingIds$.next(playingIds)
    if (playerId === hostId$.value && isNextHost(currentPlayerId, playingIds)) {
      unsubscribeCurrentGame()
      currentGameSubscriptions.push(
        lastConnectedId.subscribe(handlePeerConnection(currentPlayerId)),
        lastDisconnectedId.subscribe(handlePeerDisconnection(currentPlayerId)),
        ...takeHostRole(currentGame$.value.id, currentPlayerId)
      )
    }
  }
}

function shareCameras(currentPlayerId) {
  return function (cameras) {
    if (skipSharingCamera) {
      skipSharingCamera = false
      return
    }
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

function isNextHost(currentPlayerId, connectedIds) {
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
    (connectedPlayers.length && !firstPlaying) ||
    firstPlaying?.id === currentPlayerId
  )
}

function reset() {
  unsubscribeCurrentGame()
  closeChannels()
  currentGame$.next(null)
  hostId$.next(null)
  playingIds$.next([])
  skipSharingCamera = false
  cameras = []
  hands = []
  selections = []
  clearThread()
}

function isGameParameter(game) {
  return Boolean(game.schemaString)
}

function isDifferentGame(gameId) {
  return currentGame$.value?.id !== gameId
}
