import {
  BehaviorSubject,
  debounceTime,
  filter,
  map,
  merge,
  switchMap,
  take
} from 'rxjs'
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
import { makeLogger } from '../utils'

const logger = makeLogger('game-manager')

const playerGames$ = new BehaviorSubject([])
const currentGame$ = new BehaviorSubject()
let listGamesSubscription = null

// updates current game when receiving player updates
playerGames$.subscribe(games => {
  const current = currentGame$.value
  const update = games.find(({ id }) => id === current?.id)
  if (current && update) {
    currentGame$.next({ ...current, ...update })
  }
})

// when joining game with connected peers, delay during which we expect to receive the game data
const gameReceptionDelay = 30e3

// stores current player
let player
currentPlayer.subscribe(value => (player = value))

// resets current game and clears discussion thread when disposing game engine
let engine
engine$.subscribe(value => {
  engine = value
  if (value === null) {
    currentGame$.next(null)
    clearThread()
  }
})

// skips saving camera positions after loading them from game data
let skipSharingCamera = false
// cameras for all players
let cameras = []
// hands for all players
let hands = []

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
  return [
    // save scene
    action
      .pipe(
        filter(({ fromHand }) => !fromHand),
        debounceTime(1000)
      )
      .subscribe(action => {
        logger.info({ gameId, action }, `persisting game scene on action`)
        const game = shareGame(gameId, engine)
        runMutation(graphQL.saveGame, { game })
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
    }),
    // send game data to new peers
    lastConnectedId.subscribe(playerId => shareGame(gameId, engine, playerId))
  ]
}

function shareGame(gameId, engine, playerId) {
  logger.info(
    { gameId, playerId },
    `sending game data ${gameId} to peer${playerId ? ` ${playerId}` : 's'}`
  )
  const { meshes, handMeshes } = engine.serialize()
  const game = {
    meshes,
    id: gameId,
    hands: mergeHands({ playerId: player.id, meshes: handMeshes }),
    messages: serializeThread(),
    cameras
  }
  send({ type: 'game-sync', ...game }, playerId)
  return game
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
export const gamePlayerById = currentGame$.pipe(
  map(game => new Map((game?.players ?? []).map(player => [player.id, player])))
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
  const subscriptions = []

  function unsubscribeAll() {
    logger.info(`closing all subscriptions`)
    for (const subscription of subscriptions) {
      subscription.unsubscribe()
    }
  }

  logger.info({ gameId }, `entering game ${gameId}`)
  openChannels(player)
  engine.onDisposeObservable.addOnce(() => {
    unsubscribeAll()
    closeChannels()
  })

  let game = await runQuery(graphQL.loadGame, { gameId }, false)
  currentGame$.next(game)
  listGames() // to enable receiving player updates

  if (game.players.every(({ id, playing }) => id === player.id || !playing)) {
    // is the only playing player: take the host role
    subscriptions.push(...takeHostRole(gameId))
    await load(game, true)
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
        unsubscribeAll()
        closeChannels()
        reject(error)
      }, gameReceptionDelay)

      let isFirstLoad = true
      subscriptions.push(
        cameraSaves$.subscribe(cameras => {
          if (skipSharingCamera) {
            skipSharingCamera = false
            return
          }
          logger.info({ cameras }, `sharing camera saves with peers`)
          send({ type: 'saveCameras', cameras, playerId: player.id })
        }),
        handMeshes$.subscribe(meshes => {
          logger.info({ meshes }, `sharing hand with peers`)
          send({ type: 'saveHand', meshes, playerId: player.id })
        }),
        lastMessageReceived
          .pipe(filter(({ data }) => data?.type === 'game-sync'))
          .subscribe(({ data }) => {
            logger.info({ game }, `loading game data (${data.id})`)
            load(data, isFirstLoad)
            isFirstLoad = false
          }),
        lastMessageReceived
          .pipe(
            filter(({ data }) => data?.type === 'game-sync'),
            take(1)
          )
          .subscribe(() => {
            clearTimeout(gameReceptionTimeout)
            subscriptions.push(
              lastDisconnectedId
                .pipe(
                  switchMap(() =>
                    runQuery(graphQL.loadGamePlayers, { gameId })
                  ),
                  filter(
                    ({ players }) =>
                      player.id === players.find(({ playing }) => playing)?.id
                  ),
                  take(1)
                )
                .subscribe(() => {
                  unsubscribeAll()
                  subscriptions.push(...takeHostRole(gameId))
                })
            )
            resolve()
          })
      )
    })
  }
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
