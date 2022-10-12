import { BehaviorSubject, debounceTime, filter, map, merge } from 'rxjs'
import { clearThread, loadThread, serializeThread } from './discussion'
import {
  action,
  cameraSaves as cameraSaves$,
  engine as engine$,
  handMeshes as handMeshes$,
  loadCameraSaves
} from './game-engine'
import { runQuery, runMutation, runSubscription } from './graphql-client'
import {
  closeChannels,
  connectWith,
  lastConnectedId,
  lastDisconnectedId,
  lastMessageReceived,
  lastMessageSent,
  send,
  openChannels
} from './peer-channels'
import * as graphQL from '../graphql'
import { makeLogger, sleep } from '../utils'

// when joining game with connected peers, delay during which we expect to receive the game data
const gameReceptionDelay = 30000
const logger = makeLogger('game-manager')

const currentGame$ = new BehaviorSubject()
const hostId$ = new BehaviorSubject(null)
const playingIds$ = new BehaviorSubject([])

let delayOnLoad = () => {}

/**
 * Emits the player current game, or undefined.
 * @type {Observable<object>} TODO
 */
export const currentGame = currentGame$.asObservable()

/**
 * Emits a map of player in current game.
 * @type {Observable<Map<string, import('../graphql').Player>>}
 */
export const gamePlayerById = merge(hostId$, playingIds$, currentGame$).pipe(
  map(() => {
    const playerById = new Map()
    const game = currentGame$.value
    if (game) {
      for (const player of game.players) {
        playerById.set(player.id, {
          ...player,
          playing: playingIds$.value.includes(player.id),
          isHost: hostId$.value === player.id
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

const currentGameSubscriptions = []
let listGamesSubscription = null

let engine
engine$.subscribe(value => (engine = value))

// skips saving camera positions after loading them from game data
let skipSharingCamera = false
// cameras for all players
let cameras = []
// hands for all players
let hands = []

/**
 * Fetches an existing game from server, loading it into the provided Babylon.js engine.
 * Player must already be registered into the game.
 * If current player is the only connected player, it takes the host role, responsible for saving
 * the game and sharing it with new players.
 * If other players are connected, waits at most 30s to receive the game data from game host.
 * Resolves when the game data has been received (either as host or regular peer).
 * @async
 * @param {string} gameId - the loaded game id.
 * @param {object} session - the session details.
 */
export async function loadGame(
  gameId,
  { player: currentPlayer, turnCredentials }
) {
  if (!engine) {
    logger.warn(
      { gameId },
      `fail loading game ${gameId} as there are no current engine yet`
    )
    return
  }
  engine.onDisposeObservable.addOnce(() => {
    unsubscribeCurrentGame()
    closeChannels()
    currentGame$.next(null)
    hostId$.next(null)
    playingIds$.next([])
    skipSharingCamera = false
    cameras = []
    hands = []
    clearThread()
  })

  const currentPlayerId = currentPlayer.id

  /* istanbul ignore if */
  if (!delayOnLoad && import.meta.hot) {
    const delayKey = 'loadGameDelay'

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

  logger.info({ gameId }, `entering game ${gameId}`)
  let game = await runQuery(graphQL.loadGame, { gameId }, false)
  currentGame$.next(game)
  playingIds$.next([currentPlayerId])
  await openChannels(currentPlayer, turnCredentials)

  if (isSinglePlaying(currentPlayerId)) {
    // is the only playing player: take the host role
    const loadPromise = load(game, currentPlayerId, true)
    currentGameSubscriptions.push(
      lastConnectedId.subscribe(handlePeerConnection(currentPlayerId)),
      lastDisconnectedId.subscribe(handlePeerDisconnection(currentPlayerId)),
      ...takeHostRole(gameId, currentPlayerId)
    )
    await loadPromise
  } else {
    return new Promise((resolve, reject) => {
      const peers = game.players.filter(
        ({ id, playing }) => id !== currentPlayerId && playing
      )
      logger.info({ peers }, `connecting to other players`)
      for (const peer of peers) {
        connectWith(peer.id, turnCredentials)
      }

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
        lastConnectedId.subscribe(handlePeerConnection(currentPlayerId)),
        lastDisconnectedId.subscribe(handlePeerDisconnection(currentPlayerId)),
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
}

async function load(game, currentPlayerId, firstLoad) {
  currentGame$.next(game)
  hands = game.hands ?? []
  cameras = game.cameras ?? []
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
  await engine.load(game, currentPlayerId, firstLoad)
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

function takeHostRole(gameId, currentPlayerId) {
  logger.info({ gameId }, `taking game host role`)
  hostId$.next(currentPlayerId)
  shareGame(currentPlayerId)
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
    })
  ]
}

function handleServerUpdate(currentPlayerId) {
  return async function (game) {
    await load(game, currentPlayerId, false)
    shareGame(currentPlayerId)
  }
}

function shareGame(currentPlayerId, peerId) {
  const { id: gameId, ...otherGameData } = currentGame$.value
  logger.info(
    { gameId },
    `sending game data ${gameId} to peer${peerId ? ` ${peerId}` : 's'}`
  )
  const { handMeshes, meshes } = engine.serialize()
  const game = {
    id: gameId,
    meshes,
    hands: mergeHands({ playerId: currentPlayerId, meshes: handMeshes }),
    messages: serializeThread(),
    cameras
  }
  send({ type: 'game-sync', ...otherGameData, ...game }, peerId)
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
      const { players } = await runQuery(graphQL.getGamePlayers, game)
      currentGame$.next({ ...game, players })
    }
    if (currentPlayerId === hostId$.value) {
      shareGame(currentPlayerId, playerId)
    }
  }
}

function handlePeerDisconnection(currentPlayerId) {
  return function (playerId) {
    playingIds$.next(playingIds$.value.filter(id => id !== playerId))
    if (playerId === hostId$.value && isNextPlaying(currentPlayerId)) {
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

function isSinglePlaying(currentPlayerId) {
  return currentGame$.value.players.every(
    ({ id, playing }) => id === currentPlayerId || !playing
  )
}

function isNextPlaying(currentPlayerId) {
  const { players } = currentGame$.value
  const playingIds = playingIds$.value
  return (
    players
      .map(player => ({ ...player, playing: playingIds.includes(player.id) }))
      .find(({ playing }) => playing)?.id === currentPlayerId
  )
}
