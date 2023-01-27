// @ts-check
import { iteratePage } from './utils.js'

export async function apply({ games }) {
  let deletedCount = 0
  await iteratePage(games, async game => {
    if (game.kind === '32-cards' || game.kind === 'klondike') {
      console.log(
        `deleting old ${game.kind} game (${game.id}) of player ${game.ownerId}`
      )
      await games.deleteById(game.id)
      deletedCount++
    }
  })
  console.log(`${deletedCount} game(s) deleted`)
}
