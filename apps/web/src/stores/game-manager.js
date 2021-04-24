import { auditTime } from 'rxjs/operators'
import {
  connectWith,
  lastConnected,
  lastMessageReceived,
  send
} from './communication'
import { action } from './game-engine'
import { makeLogger } from '../utils'
import { loadScene, serializeScene } from '../3d/utils'

const logger = makeLogger('game-manager')

async function persistGame(game) {
  const { id } = game
  logger.debug({ id }, `persisting game ${id}`)
  // TODO persist on server
  sessionStorage.setItem(`game-${id}`, JSON.stringify(game))
}

export async function createGame(name = 'splendor') {
  const id = Math.floor(Math.random() * 100000).toString()
  logger.info({ id, name }, `create new ${name} game (${id})`)
  const { default: scene } = await import(`../games/${name}/scene.json`)
  await persistGame({ id, scene })
  return id
}

export async function joinGame(id) {
  logger.info({ id }, `connecting to game ${id}`)
  // TODO server will return game from ID, then connect player ids
  // for now, consider the id to be a player id, and awaits for game
  await connectWith(id)
  return new Promise(resolve => {
    const subscription = lastMessageReceived.subscribe(({ data }) => {
      if (data?.id && data?.scene) {
        logger.debug(data, `receiving game data (${data.id})`)
        // persist scene from host, so loadGame() could find it
        persistGame(data)
        subscription.unsubscribe()
        // TODO for now, return id from received game data
        resolve(data.id)
      }
    })
  })
}

export async function loadGame(id, engine) {
  logger.info({ id }, `loading game ${id} into engine`)
  // TODO handle missing/invalid games
  const game = JSON.parse(sessionStorage.getItem(`game-${id}`))
  loadScene(engine, engine.scenes[0], game.scene)
  const subscriptions = [
    action
      .pipe(auditTime(1000))
      .subscribe(() =>
        persistGame({ id, scene: serializeScene(engine.scenes[0]) })
      ),
    lastConnected.subscribe(peer => {
      logger.info({ id, peer }, `sending game data ${id} to peer ${peer}`)
      send({ id, scene: serializeScene(engine.scenes[0]) }, peer)
    })
  ]
  engine.onDisposeObservable.addOnce(() => {
    for (const subscription of subscriptions) {
      subscription.unsubscribe()
    }
  })
}
