import repositories from '../repositories/index.js'

/**
 * @typedef {object} CatalogItem a catalog item
 * @property {string} name - item unique name.
 * @property {boolean} restricted - whether this game has restricted access
 */

/**
 * Computes a given player's catalog, only including free games and restricted games they can access.
 * @async
 * @param {import('./players').Player} player - related player
 * @returns {CatalogItem[]} the full list of catalog items for this player.
 */
export async function listCatalog(player) {
  const results = []
  for (const item of (await repositories.catalogItems.list()).results) {
    if (!item.restricted || player.catalog?.includes(item.name)) {
      results.push(item)
    }
  }
  return results
}
