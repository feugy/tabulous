import repositories from '../repositories/index.js'

/**
 * @typedef {object} CatalogItem a catalog item
 * @property {string} name - item unique name.
 * @property {boolean} restricted - whether this game has restricted access
 */

/**
 * Computes a given player's catalog, only including free games and restricted games they can access.
 * @async
 * @param {import('./players').Player} player - related player.
 * @returns {CatalogItem[]} the full list of catalog items for this player.
 */
export async function listCatalog(player) {
  const results = []
  for (const item of (await repositories.catalogItems.list()).results) {
    if (canAccess(player, item)) {
      results.push(item)
    }
  }
  return results
}

/**
 * Indicates whether a given player can access the provided catalog item.
 * @param {import('./players').Player} player - related player.
 * @param {CatalogItem} item - the checked catalog item.
 * @returns {boolean} true when the item is publicly available or if this player was granted access.
 */
export function canAccess(player, item) {
  return !item.restricted || player?.catalog?.includes(item.name)
}
