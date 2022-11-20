import { listCatalog, listGames } from '@src/stores'

/** @type {import('./$types').PageLoad} */
export async function load({ parent }) {
  const data = await parent()
  const [catalog, currentGames] = await Promise.all([
    listCatalog(),
    data.session?.player ? listGames() : Promise.resolve(null)
  ])
  return { catalog, currentGames }
}
