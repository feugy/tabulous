// @ts-check
/** @type {import('.').Apply} */
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
