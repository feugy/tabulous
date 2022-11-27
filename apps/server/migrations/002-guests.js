// @ts-check

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

async function iteratePage(repository, apply, { from = 0 } = {}) {
  const { total, results } = await repository.list({ from })
  for (const obj of results) {
    await apply(obj)
  }
  const next = from + results.length
  if (total > next) {
    await iteratePage(repository, apply, { from: next })
  }
}
