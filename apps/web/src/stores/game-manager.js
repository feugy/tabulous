import { BehaviorSubject } from 'rxjs'
import { debounceTime } from 'rxjs/operators'
import { currentPlayer } from './authentication'
import { action } from './game-engine'
import { runQuery, runMutation } from './graphcl-client'
import {
  closeChannels,
  connectWith,
  lastConnectedId,
  lastDisconnectedId,
  lastMessageReceived,
  send,
  openChannels
} from './peer-channels'
import { inviteReceived } from './sse'
import * as graphQL from '../graphql'
import { makeLogger } from '../utils'
import { loadScene, serializeScene } from '../3d/utils'

const logger = makeLogger('game-manager')

let player
currentPlayer.subscribe(value => (player = value))
inviteReceived.subscribe(() => listGames())

const playerGames$ = new BehaviorSubject([])

function takeHostRole(gameId, engine) {
  logger.info({ gameId }, `taking game host role`)
  scheduleCleanup(
    new Map([
      [
        'save',
        action.pipe(debounceTime(1000)).subscribe(() => {
          logger.debug({ gameId }, `persisting game ${gameId}`)
          const saved = serializeScene(engine.scenes[0])
          sessionStorage.setItem(`game-${gameId}`, JSON.stringify(saved))
          runMutation(graphQL.saveGame, { game: { id: gameId, scene: saved } })
        })
      ],
      [
        'sendGame',
        lastConnectedId.subscribe(peerId => {
          logger.info(
            { gameId, peerId },
            `sending game data ${gameId} to peer ${peerId}`
          )
          send({ gameId, scene: serializeScene(engine.scenes[0]) }, peerId)
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
 * Emits the list of current player's games
 * @type {Observable<object>}
 */
export const playerGames = playerGames$.asObservable()

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

  let game = await runQuery(graphQL.loadGame, { gameId })

  if (game.players.every(({ id, playing }) => id === player.id || !playing)) {
    // is the only playing player: take the host role
    loadScene(engine, engine.scenes[0], game.scene)
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
