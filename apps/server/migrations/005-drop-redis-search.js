// @ts-check
/**
 * @typedef {import('ioredis').Redis} Redis
 * @typedef {typeof import('@tabulous/server/src/repositories').default} Repositories
 */

import { iteratePage } from './utils.js'

/**
 * Applies the migration.
 * @param {Repositories} repositories - connected repositories.
 * @param {Redis} redis - initialized Redis client.
 * @returns {Promise<void>}
 */
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
