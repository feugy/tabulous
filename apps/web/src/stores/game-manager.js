import { BehaviorSubject, merge } from 'rxjs'
import { debounceTime, filter } from 'rxjs/operators'
import { currentPlayer } from './authentication'
import { clearThread, loadThread, serializeThread } from './discussion'
import { action, engine } from './game-engine'
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

function takeHostRole(gameId, engine) {
  logger.info({ gameId }, `taking game host role`)
  scheduleCleanup(
    new Map([
      [
        'saveScene',
        action.pipe(debounceTime(1000)).subscribe(() => {
          logger.debug({ gameId }, `persisting game (${gameId}) scene`)
          runMutation(graphQL.saveGame, {
            game: { id: gameId, scene: serializeScene(engine.scenes[0]) }
          })
        })
      ],
      [
        'saveThread',
        merge(lastMessageSent, lastMessageReceived)
          .pipe(
            filter(({ data }) => data?.type === 'message'),
            debounceTime(1000)
          )
          .subscribe(() => {
            logger.debug({ gameId }, `persisting game (${gameId}) thread`)
            runMutation(graphQL.saveGame, {
              game: { id: gameId, messages: serializeThread() }
            })
          })
      ],
      [
        'sendGame',
        lastConnectedId.subscribe(peerId => {
          logger.info(
            { gameId, peerId },
            `sending game data ${gameId} to peer ${peerId}`
          )
          send(
            {
              gameId,
              scene: serializeScene(engine.scenes[0]),
              messages: serializeThread()
            },
            peerId
          )
        })
      ]
    ]),
    engine
  )
}

function scheduleCleanup(subscriptions, engine) {
  engine.onDisposeObservable.addOnce(() => {
    for (const [, subscription] of subscriptions) {
      subscription.unsubscribe()
    }
    subscriptions.clear()
    closeChannels()
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
  logger.info({ gameId }, `loading game ${gameId} into engine`)
  await openChannels(player)

  let game = await runQuery(graphQL.loadGame, { gameId }, false)
  currentGame$.next(game)

  if (game.players.every(({ id, playing }) => id === player.id || !playing)) {
    // is the only playing player: take the host role
    loadScene(engine, engine.scenes[0], game.scene)
    loadThread(game.messages)
    takeHostRole(gameId, engine)
  } else {
    // connect with other players that are already playing
    game.players
      .filter(({ id, playing }) => id !== player.id && playing)
      .map(connectWith)

    const subscriptions = new Map([
      // load game scene received from host
      [
        'loadScene',
        lastMessageReceived.subscribe(({ data }) => {
          if (data?.gameId && data?.scene) {
            logger.debug(data, `receiving game data (${data.gameId})`)
            loadScene(engine, engine.scenes[0], data.scene)
            loadThread(data.messages)
            subscriptions.get('loadScene').unsubscribe()
            subscriptions.delete('loadScene')
          }
        })
      ],
      // and awaits on disconnection, to potentially become host
      [
        'electHost',
        lastDisconnectedId.subscribe(async () => {
          const { players } = await runQuery(graphQL.loadGamePlayers, {
            gameId
          })
          const nextHost = players.find(({ playing }) => playing)
          if (nextHost?.id === player.id) {
            takeHostRole(gameId, engine)
            subscriptions.get('electHost').unsubscribe()
            subscriptions.delete('electHost')
          }
        })
      ]
    ])
    scheduleCleanup(subscriptions, engine)
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
