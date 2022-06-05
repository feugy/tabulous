import { BehaviorSubject, debounceTime, filter, map, merge } from 'rxjs'
import { currentPlayer } from './players'
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

const playerGames$ = new BehaviorSubject([])
const currentGame$ = new BehaviorSubject()
const hostId$ = new BehaviorSubject(null)
const playingIds$ = new BehaviorSubject([])

let delayOnLoad = () => {}

/* istanbul ignore if */
if (import.meta.hot) {
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
      if (hostId$.value && hostId$.value !== player?.id) {
        console.warn(
          'Since there are multiple connected players, HMR is slightly delayed to let host reconnect'
        )
        sessionStorage.setItem(delayKey, 3000)
      }
    }
  })
}

/**
 * Emits the list of current player's games.
 * @type {Observable<object>} TODO
 */
export const playerGames = playerGames$.asObservable()

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
 * Lists all games of the current player, populating `playerGames` observable.
 * @async
 */
export async function listGames() {
  if (listGamesSubscription) {
    listGamesSubscription.unsubscribe()
  }
  listGamesSubscription = runSubscription(graphQL.listGames).subscribe(
    playerGames$
  )
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
  await load(game, false)
  return true
}

const currentGameSubscriptions = []
let listGamesSubscription = null

// stores current player
let player
currentPlayer.subscribe(value => (player = value))

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
 */
export async function loadGame(gameId) {
  if (!player || !engine) {
    logger.warn(
      { gameId },
      `fail loading game ${gameId} as there are no current player/engine yet`
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

  await delayOnLoad()

  logger.info({ gameId }, `entering game ${gameId}`)
  let game = await runQuery(graphQL.loadGame, { gameId }, false)
  currentGame$.next(game)
  playingIds$.next([player.id])
  openChannels(player)

  if (isSinglePlaying()) {
    // is the only playing player: take the host role
    const loadPromise = load(game, true)
    currentGameSubscriptions.push(
      lastConnectedId.subscribe(handlePeerConnection),
      lastDisconnectedId.subscribe(handlePeerDisconnection),
      ...takeHostRole(gameId)
    )
    await loadPromise
  } else {
    return new Promise((resolve, reject) => {
      const peers = game.players.filter(
        ({ id, playing }) => id !== player.id && playing
      )
      logger.info({ peers }, `connecting to other players`)
      for (const peer of peers) {
        connectWith(peer.id)
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
        lastConnectedId.subscribe(handlePeerConnection),
        lastDisconnectedId.subscribe(handlePeerDisconnection),
        cameraSaves$.subscribe(shareCameras),
        handMeshes$.subscribe(shareHand),
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
            load(data, isFirstLoad)
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

async function load(game, firstLoad) {
  hands = game.hands ?? []
  cameras = game.cameras ?? []
  if (game.messages) {
    loadThread(game.messages)
  }
  if (cameras.length) {
    const playerCameras = cameras
      .filter(save => save.playerId === player.id)
      .sort((a, b) => a.index - b.index)
    if (playerCameras.length) {
      skipSharingCamera = true
      loadCameraSaves(playerCameras)
    }
  }
  await engine.load(game, player.id, firstLoad)
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

function takeHostRole(gameId) {
  logger.info({ gameId }, `taking game host role`)
  hostId$.next(player.id)
  shareGame()
  return [
    // save scene
    action
      .pipe(
        filter(({ fromHand }) => !fromHand),
        debounceTime(1000)
      )
      .subscribe(action => {
        logger.info({ gameId, action }, `persisting game scene on action`)
        runMutation(graphQL.saveGame, { game: shareGame() })
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
        map(meshes => ({ data: { playerId: player.id, meshes } }))
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
        map(cameras => ({ data: { playerId: player.id, cameras } }))
      )
    ).subscribe(({ data }) => {
      mergeCameras(data)
      saveCameras(gameId)
    })
  ]
}

function shareGame(peerId) {
  const gameId = currentGame$.value.id
  logger.info(
    { gameId },
    `sending game data ${gameId} to peer${peerId ? ` ${peerId}` : 's'}`
  )
  const { handMeshes, ...gameData } = engine.serialize()
  const game = {
    ...gameData,
    id: gameId,
    hands: mergeHands({ playerId: player.id, meshes: handMeshes }),
    messages: serializeThread(),
    cameras
  }
  send({ type: 'game-sync', ...game }, peerId)
  return game
}

function unsubscribeCurrentGame() {
  logger.info(`closing all subscriptions`)
  for (const subscription of currentGameSubscriptions) {
    subscription.unsubscribe()
  }
  currentGameSubscriptions.splice(0, currentGameSubscriptions.length)
}

function handlePeerConnection(playerId) {
  playingIds$.next([...playingIds$.value, playerId])
  if (player.id === hostId$.value) {
    shareGame(playerId)
  }
}

function handlePeerDisconnection(playerId) {
  playingIds$.next(playingIds$.value.filter(id => id !== playerId))
  if (playerId === hostId$.value && isNextPlaying()) {
    unsubscribeCurrentGame()
    currentGameSubscriptions.push(
      lastConnectedId.subscribe(handlePeerConnection),
      lastDisconnectedId.subscribe(handlePeerDisconnection),
      ...takeHostRole(currentGame$.value)
    )
  }
}

function shareCameras(cameras) {
  if (skipSharingCamera) {
    skipSharingCamera = false
    return
  }
  logger.info({ cameras }, `sharing camera saves with peers`)
  send({ type: 'saveCameras', cameras, playerId: player.id })
}

function shareHand(meshes) {
  logger.info({ meshes }, `sharing hand with peers`)
  send({ type: 'saveHand', meshes, playerId: player.id })
}

function isSinglePlaying() {
  return currentGame$.value.players.every(
    ({ id, playing }) => id === player.id || !playing
  )
}

function isNextPlaying() {
  const { players } = currentGame$.value
  const playingIds = playingIds$.value
  return (
    players
      .map(player => ({ ...player, playing: playingIds.includes(player.id) }))
      .find(({ playing }) => playing)?.id === player.id
  )
}
