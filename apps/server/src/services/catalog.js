// @ts-check
import * as repositories from '../repositories/index.js'
import { makeLogger } from '../utils/index.js'

const logger = makeLogger('catalog-service')

/**
 * Computes a given player's catalog, only including free games and restricted games they can access.
 * @param {?import('@tabulous/types').Player} player - related player.
 * @returns the full list of catalog items for this player.
 */
export async function listCatalog(player) {
  const ctx = { playerId: player?.id }
  logger.trace({ ctx }, 'list catalog')
  const results = []
  for (const item of (await repositories.catalogItems.list()).results) {
    if (canAccess(player, item)) {
      results.push(item)
    }
  }
  logger.debug({ ctx, res: results.length }, 'listed catalog')
  return results
}

/**
 * Indicates whether a given player can access the provided catalog item.
 * @param {?import('@tabulous/types').Player} player - related player.
 * @param {import('@tabulous/types').GameDescriptor} item - the checked catalog item.
 * @returns true when the item is publicly available or if this player was granted access.
 */
export function canAccess(player, item) {
  const accessGranted = item.copyright
    ? player?.catalog?.includes(item.name) ?? false
    : true
  logger.trace(
    { ctx: { playerId: player?.id, itemName: item.name }, res: accessGranted },
    'checked catalog access'
  )
  return accessGranted
}

/**
 * Grants access to a catalog item to a given player.
 * Does nothing when player or item is unknown, or if item is not copyrighted
 * @param {string} playerId - id of the related player.
 * @param {string} itemName - catalog item name this player will have access to.
 * @returns saved player, or null
 */
export async function grantAccess(playerId, itemName) {
  const ctx = { playerId, itemName }
  logger.trace({ ctx }, 'granting catalog access')
  const player = await repositories.players.getById(playerId)
  const item = await repositories.catalogItems.getById(itemName)
  if (player && item && item.copyright) {
    if (!player.catalog) {
      player.catalog = []
    }
    if (!player.catalog.includes(itemName)) {
      player.catalog.push(itemName)
      const result = await repositories.players.save(player)
      logger.debug({ ctx, res: true }, 'granted catalog access')
      return result
    }
  }
  logger.debug({ ctx, res: false }, 'granted catalog access')
  return null
}

/**
 * Revokes access to a catalog item for a given player.
 * Does nothing when player or item is unknown, or if item is not copyrighted
 * @param {string} playerId - id of the related player.
 * @param {string} itemName - catalog item name this player will lost access to.
 * @returns saved player, or null
 */
export async function revokeAccess(playerId, itemName) {
  const ctx = { playerId, itemName }
  logger.trace({ ctx }, 'revoking catalog access')
  const player = await repositories.players.getById(playerId)
  const item = await repositories.catalogItems.getById(itemName)
  if (player && item && item.copyright) {
    if (player.catalog) {
      const index = player.catalog.indexOf(itemName)
      if (index >= 0) {
        player.catalog.splice(index, 1)
        const result = await repositories.players.save(player)
        logger.debug({ ctx, res: true }, 'revoked catalog access')
        return result
      }
    }
  }
  logger.debug({ ctx, res: false }, 'revoked catalog access')
  return null
}
