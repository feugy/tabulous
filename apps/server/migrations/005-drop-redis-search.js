// @ts-check
import { iteratePage } from './utils.js'

/** @type {import('.').Apply} */
export async function apply({ players }, redis) {
  await redis.del('autocomplete:players:username')
  console.log(`players username index deleted`)
  await iteratePage(players, async player => {
    if (player.usernameSearchable === undefined) {
      console.log(
        `setting searchability for player ${player.username} (${player.id})`
      )
      await players.save({ ...player, usernameSearchable: true })
    }
  })
}
