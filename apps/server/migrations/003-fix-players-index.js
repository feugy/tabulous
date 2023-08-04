// @ts-check
/**
 * @typedef {import('ioredis').Redis} Redis
 * @typedef {typeof import('@tabulous/server/src/repositories').default} Repositories
 */

/**
 * Applies the migration.
 * @param {Repositories} repositories - connected repositories.
 * @param {Redis} redis - initialized Redis client.
 * @returns {Promise<void>}
 */
export async function apply({ players }, redis) {
  console.log('delete undefined provider index')
  await redis.del('index:players:providers:undefined:undefined')
  const playerIds = await redis.keys('players:*')
  console.log(`re-indexing ${playerIds.length} players`)
  for (const fullId of playerIds) {
    const id = fullId.replace(/^players:/, '')
    console.log(`assign player ${id} score: ${players.nextScore}`)
    await redis
      .multi()
      .set(players.scoreKey, players.nextScore)
      .zadd(players.indexKey, players.nextScore++, id)
      .exec()
  }
}
