import { BehaviorSubject } from 'rxjs'
import { auditTime } from 'rxjs/operators'
import { currentPlayer } from './authentication'
import { action } from './game-engine'
import { runQuery, runMutation } from './graphcl-client'
import {
  closeChannels,
  connected,
  connectWith,
  lastConnected,
  lastMessageReceived,
  send,
  startAccepting
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
  const subscriptions = [
    action.pipe(auditTime(1000)).subscribe(() => {
      logger.debug({ gameId }, `persisting game ${gameId}`)
      const saved = serializeScene(engine.scenes[0])
      sessionStorage.setItem(`game-${gameId}`, JSON.stringify(saved))
      runMutation(graphQL.saveGame, { game: { id: gameId, scene: saved } })
    }),
    lastConnected.subscribe(peer => {
      logger.info(
        { gameId, peer },
        `sending game data ${gameId} to peer ${peer}`
      )
      send({ gameId, scene: serializeScene(engine.scenes[0]) }, peer)
    })
  ]
  engine.onDisposeObservable.addOnce(() => {
    for (const subscription of subscriptions) {
      subscription.unsubscribe()
    }
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
  logger.info({ gameId }, `loading game ${gameId} into engine`)
  const subscriptions = []
  const game = await runQuery(graphQL.loadGame, { gameId })

  // connect with all other players
  await startAccepting(player)
  engine.onDisposeObservable.addOnce(() => {
    for (const subscription of subscriptions) {
      subscription.unsubscribe()
    }
    subscriptions.splice(0, subscriptions.length)
    closeChannels()
  })

  const connectPromises = game.playerIds
    .filter(id => id !== player.id)
    .map(connectWith)
  // then load the game scene
  loadScene(engine, engine.scenes[0], game.scene)

  const connectionStatuses = await Promise.allSettled(connectPromises)
  if (connectionStatuses.every(status => status === 'rejected')) {
    // if the single player, becomes host
    takeHostRole(gameId, engine)
  } else {
    // if not, load game scene received from host
    subscriptions.push(
      lastMessageReceived.subscribe(({ data }) => {
        if (data?.gameId && data?.scene) {
          logger.debug(data, `receiving game data (${data.gameId})`)
          loadScene(engine, engine.scenes[0], data.scene)
        }
      })
    )
    // and awaits on disconnection, to potentially become host
    const index = game.playerIds.indexOf(player.id)
    subscriptions.push(
      connected.subscribe(peerIds => {
        logger.debug({ peerIds }, `peers have joined or left`)
        let hasHost = false
        for (let i = 0; !hasHost && i < index; i++) {
          // a previous player in player list is connected, they are host
          hasHost = peerIds.includes(game.playerIds[i])
        }
        if (!hasHost) {
          for (const subscription of subscriptions) {
            subscription.unsubscribe()
          }
          subscriptions.splice(0, subscriptions.length)
          takeHostRole(gameId, engine)
        }
      })
    )
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
