import { createGame, listCatalog, listGames } from '@src/stores'
import { redirect } from '@sveltejs/kit'

/** @type {import('./$types').PageLoad} */
export async function load({ parent, url }) {
  const data = await parent()
  const hasPlayer = data.session?.player
  const [catalog, currentGames] = await Promise.all([
    listCatalog(),
    hasPlayer ? listGames() : Promise.resolve(null)
  ])
  let creationError = null
  const name = url.searchParams.get('game-name')
  if (name && hasPlayer) {
    let gameId
    try {
      gameId = await createGame(name)
    } catch (err) {
      creationError = err
    }
    if (gameId) {
      throw redirect(307, `/game/${gameId}`)
    }
  }
  return { catalog, currentGames, creationError }
}
