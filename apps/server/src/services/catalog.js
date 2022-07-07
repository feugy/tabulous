import repositories from '../repositories/index.js'

/**
 * @typedef {object} CatalogItem a catalog item
 * @property {string} name - item unique name.
 * @property {Copyright} [copyright] - copyright data, meaning this item has restricted access
 */

/**
 * @typedef {object} Copyright game copyright data
 * @property {GameAuthor[]} authors - game authors.
 * @property {GameAuthor[]} [designer] - game designers.
 * @property {GameAuthor[]} [publishers] - game publishers.
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
  return !item.copyright || player?.catalog?.includes(item.name)
}

/**
 * Grants access to a catalog item to a given player.
 * Does nothing when player or item is unknown, or if item is not copyrighted
 * @param {string} playerId - id of the related player.
 * @param {string} itemName - catalog item name this player will have access to.
 * @returns {import('./players').Player|null} saved player, or null
 */
export async function grantAccess(playerId, itemName) {
  const player = await repositories.players.getById(playerId)
  const item = await repositories.catalogItems.getById(itemName)
  if (player && item && item.copyright) {
    if (!player.catalog) {
      player.catalog = []
    }
    if (!player.catalog.includes(itemName)) {
      player.catalog.push(itemName)
      return await repositories.players.save(player)
    }
  }
  return null
}

/**
 * Revokes access to a catalog item for a given player.
 * Does nothing when player or item is unknown, or if item is not copyrighted
 * @param {string} playerId - id of the related player.
 * @param {string} itemName - catalog item name this player will lost access to.
 * @returns {import('./players').Player|null} saved player, or null
 */
export async function revokeAccess(playerId, itemName) {
  const player = await repositories.players.getById(playerId)
  const item = await repositories.catalogItems.getById(itemName)
  if (player && item && item.copyright) {
    const index = player.catalog?.indexOf(itemName)
    if (index >= 0) {
      player.catalog.splice(index, 1)
      return await repositories.players.save(player)
    }
  }
  return null
}
