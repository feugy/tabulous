// @ts-check

/**
 * Applies the migration.
 * @param {typeof import('../src/repositories/index.js').default} repositories - connected repositories.
 * @param {import('ioredis').Redis} redis - initialized Redis client.
 * @returns {Promise<void>}
 */
export async function apply(repositories, redis) {
  await redis.del('autocomplete:players:username')
  console.log(`players username index deleted`)
}
