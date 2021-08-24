import { BehaviorSubject, merge } from 'rxjs'
import { debounceTime, filter } from 'rxjs/operators'
import { currentPlayer } from './authentication'
import { clearThread, loadThread, serializeThread } from './discussion'
import { action, cameraSaves, engine, loadCameraSaves } from './game-engine'
import { runQuery, runMutation } from './graphql-client'
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
import { inviteReceived } from './sse'
import * as graphQL from '../graphql'
import { makeLogger } from '../utils'
import { loadScene, serializeScene } from '../3d/utils'

const logger = makeLogger('game-manager')

const playerGames$ = new BehaviorSubject([])
const currentGame$ = new BehaviorSubject()

// when joining game with connected peers, delay during which we expect to receive the game data
const gameReceptionDelay = 30e3

// stores current player
let player
currentPlayer.subscribe(value => (player = value))

// updates game list on deletions
inviteReceived.subscribe(() => listGames())

// resets current game and clears discussion thread when disposing game engine
engine.subscribe(engine => {
  if (engine === null) {
    currentGame$.next(null)
    clearThread()
  }
})

// skips saving camera positions after loading them from game data
let skipSharingCamera = false
// cameras for all players
let cameras = []

function load(game, engine) {
  loadScene(engine, game.scene)
  loadThread(game.messages)
  cameras = game.cameras ?? []
  const playerCameras = cameras
    .filter(save => save.playerId === player.id)
    .sort((a, b) => a.index - b.index)
  if (playerCameras.length) {
    skipSharingCamera = true
    loadCameraSaves(playerCameras)
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
  logger.info({ gameId, cameras: cameras }, `persisting game cameras`)
  runMutation(graphQL.saveGame, { game: { id: gameId, cameras } })
}

function takeHostRole(gameId, engine) {
  logger.info({ gameId }, `taking game host role`)
  return [
    // save scene
    action.pipe(debounceTime(1000)).subscribe(() => {
      logger.info({ gameId }, `persisting game scene`)
      runMutation(graphQL.saveGame, {
        game: { id: gameId, scene: serializeScene(engine) }
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
    // save camera positions from peers
    lastMessageReceived
      .pipe(filter(({ data }) => data?.type === 'saveCameras'))
      .subscribe(({ data }) => {
        mergeCameras(data)
        saveCameras(gameId)
      }),
    // save player own camera positions
    cameraSaves.subscribe(cameras => {
      if (skipSharingCamera) {
        skipSharingCamera = false
        return
      }
      mergeCameras({ playerId: player.id, cameras })
      saveCameras(gameId)
    }),
    // send game data to new peers
    lastConnectedId.subscribe(peerId => {
      logger.info(
        { gameId, peerId },
        `sending game data ${gameId} to peer ${peerId}`
      )
      send(
        {
          gameId,
          scene: serializeScene(engine),
          messages: serializeThread(),
          cameras
        },
        peerId
      )
    })
  ]
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
 * Lists all games of the current player, populating `playerGames`.
 * @async
 */
export async function listGames() {
  playerGames$.next((await runQuery(graphQL.listGames, {}, false)) || [])
}

/**
 * Creates a new game of a given kind on server, registering current player in it,
 * and receiving its id.
 * @async
 * @param {string} kind - created game kind
 * @returns {string} the created game id
 */
export async function createGame(kind = 'splendor') {
  const game = await runMutation(graphQL.createGame, { kind })
  logger.info(game, `create new ${kind} game (${game.id})`)
  return game.id
}

/**
 * Deletes a game owned by current player, and refreshes the game list.
 * @async
 * @param {string} gameId - the deleted game id
 */
export async function deleteGame(gameId) {
  logger.info({ gameId }, `deletes game (${gameId})`)
  await runMutation(graphQL.deleteGame, { gameId })
  await listGames()
}

/**
 * Fetches an existing game from server, loading it into the provided Babylon.js engine.
 * Player must already be registered into the game.
 * If current player is the only connected player, it takes the host role, responsible for saving
 * the game and sharing it with new players.
 * If other players are connected, waits at most 30s to receive the game data from game host.
 * Resolves when the game data has been received (either as host or regular peer).
 * @async
 * @param {string} gameId - the loaded game id
 * @param {@babylonjs.Engine} engine - game engine used to play
 */
export async function loadGame(gameId, engine) {
  if (!player) {
    logger.warn(
      { gameId },
      `fail loading game ${gameId} as there are no current player yet`
    )
    return
  }
  const subscriptions = []

  logger.info({ gameId }, `entering game ${gameId}`)
  await openChannels(player)
  engine.onDisposeObservable.addOnce(() => {
    logger.info(`closing all subscriptions and channels`)
    for (const subscription of subscriptions) {
      subscription.unsubscribe()
    }
    closeChannels()
  })

  let game = await runQuery(graphQL.loadGame, { gameId }, false)
  currentGame$.next(game)

  subscriptions.push(
    // share camera positions with others
    cameraSaves.subscribe(cameras => {
      if (skipSharingCamera) {
        skipSharingCamera = false
        return
      }
      logger.info({ cameras }, `sharing camera saves with peers`)
      send({ type: 'saveCameras', cameras, playerId: player.id })
    }),
    // receive camera positions from others
    lastMessageReceived
      .pipe(filter(({ data }) => data?.type === 'saveCameras'))
      .subscribe(({ data }) => mergeCameras(data))
  )

  if (game.players.every(({ id, playing }) => id === player.id || !playing)) {
    // is the only playing player: take the host role
    load(game, engine)
    subscriptions.push(...takeHostRole(gameId, engine))
  } else {
    return new Promise((resolve, reject) => {
      const peers = game.players.filter(
        ({ id, playing }) => id !== player.id && playing
      )
      logger.info({ peers }, `connecting to other players`)
      for (const peer of peers) {
        connectWith(peer)
      }

      const gameReceptionTimeout = setTimeout(() => {
        const error = new Error(
          `No game data after ${Math.floor(gameReceptionDelay / 1000)}s`
        )
        logger.error(error.message)
        reject(error)
      }, gameReceptionDelay)

      const once = lastMessageReceived
        .pipe(filter(({ data }) => data?.gameId && data?.scene))
        .subscribe(({ data }) => {
          clearTimeout(gameReceptionTimeout)
          once.unsubscribe()
          logger.info({ game }, `receiving game data (${data.gameId})`)
          load(data, engine)

          // elect new host
          subscriptions.push(
            lastDisconnectedId.subscribe(async () => {
              const { players } = await runQuery(graphQL.loadGamePlayers, {
                gameId
              })
              const nextHost = players.find(({ playing }) => playing)
              if (nextHost?.id === player.id) {
                takeHostRole(gameId, engine)
              }
            })
          )
          resolve()
        })
      subscriptions.push(once)
    })
  }
}

/**
 * Invites another player to a given game.
 * @async
 * @param {string} gameId - the shared game id
 * @param {string} playerId - the invited player id
 */
export async function invite(gameId, playerId) {
  logger.info(
    { gameId, playerId },
    `invite player ${playerId} to game ${gameId}`
  )
  await runMutation(graphQL.invite, { gameId, playerId })
}
