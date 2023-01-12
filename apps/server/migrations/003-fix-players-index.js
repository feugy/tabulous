// @ts-check

import { iteratePage } from './utils.js'

export async function apply(repositories, redis) {
  await redis.del('index:players:providers:undefined:undefined')
  await iteratePage(repositories.players, async player => {
    // save player to include them in the players index.
    await repositories.players.save(player)
  })
}
