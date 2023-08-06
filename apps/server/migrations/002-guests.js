// @ts-check
import { iteratePage } from './utils.js'

/** @type {import('.').Apply} */
export async function apply(repositories) {
  await iteratePage(repositories.games, async game => {
    let modified = false
    if (!Array.isArray(game.guestIds)) {
      modified = true
      game.guestIds = []
    }
    if (!game.ownerId) {
      modified = true
      game.ownerId = game.playerIds[0] ?? game.guestIds[0]
    }
    if (modified) {
      await repositories.games.save(game)
    }
  })
}
