// @ts-check
import repositories from '../repositories/index.js'
import { makeLogger } from '../utils/index.js'

/** @typedef {import('./players.js').Player} Player */
/** @typedef {import('./games.js').StartedGameData} GameData */
/** @typedef {import('./games.js').Schema} Schema */
/** @typedef {import('../utils/games.js').GameSetup} GameSetup */

/**
 * @typedef {object} GameDescriptor a catalog item
 * @property {string} name - item unique name.
 * @property {ItemLocales} locales - all the localized data fort his item.
 * @property {number} [minSeats] - minimum seats required to play, when relevant.
 * @property {number} [maxSeats] - maximum seats allowed, when relevant.
 * @property {number} [minAge] - minimum age suggested.
 * @property {number} [maxAge] - maximum age suggested.
 * @property {number} [minTime] - minimum time observed.
 * @property {Copyright} [copyright] - copyright data, meaning this item has restricted access.
 * @property {number} [rulesBookPageCount] - number of pages in the rules book, if any.
 * @property {ZoomSpec} [zoomSpec] - zoom specifications for main and hand scene.
 * @property {TableSpec} [tableSpec] - table specifications to customize visual.
 * @property {ColorSpec} [colors] - allowed colors for players and UI.
 * @property {ActionSpec} [actions] - action customizations.
 * @property {() => GameSetup | Promise<GameSetup>} [build] - function invoked build initial game.
 * @property {(game: GameData, guest: Player, parameters: ?object) => GameData | Promise<GameData>} [addPlayer] - function invoked when a player joins a game for the first time.
 * @property {(args: { game: GameData; player: Player }) => Schema | Promise<Schema>} [askForParameters] - function invoked to generate a joining player's parameters.
 */

/**
 * @typedef {object} ItemLocales All the localized data for this catalog item.
 * @property {ItemLocale} [fr] - French locale
 * @property {ItemLocale} [en] - English locale
 */

/**
 * @typedef {object} ItemLocale Localized data
 * @property {string} title - catalog item title.
 */

/**
 * @typedef {object} PersonOrCompany a game author, designer or publisher
 * @property {string} name - this person/company's name
 */

/**
 * @typedef {object} Copyright game copyright data
 * @property {PersonOrCompany[]} authors - game authors.
 * @property {PersonOrCompany[]} [designer] - game designers.
 * @property {PersonOrCompany[]} [publishers] - game publishers.
 */

/**
 * @typedef {object} ZoomSpec zoom specifications for main and hand scene.
 * @property {number} [min] - minimum zoom level allowed on the main scene.
 * @property {number} [max] - maximum zoom level allowed on the main scene.
 * @property {number} [hand] - fixed zoom level for the hand scene.
 */

/**
 * @typedef {object} TableSpec table specifications for customization.
 * @property {number} [width] - minimum zoom level allowed on the main scene.
 * @property {number} [height] - maximum zoom level allowed on the main scene.
 * @property {string} [texture] - texture image file path, or hex color.
 */

/**
 * @typedef {object} ColorSpec players and UI color customization.
 * @property {string} [base] - base hex color.
 * @property {string} [primary] - primary hex color.
 * @property {string} [secondary] - secondary hex color.
 * @property {string[]} [players] - list of possible colors for players.
 */

/**
 * @typedef {'decrement'|'detail'|'draw'|'flip'|'flipAll'|'increment'|'pop'|'push'|'random'|'reorder'|'rotate'|'setFace'|'snap'|'toggleLock'|'unsnap'|'unsnapAll'} ActionName
 */

/**
 * @typedef {object} ActionSpec action buttons configuration.
 * @property {ActionName[]} [button1] - actions assigned to tab/left click, if any.
 * @property {ActionName[]} [button2] - actions assigned to double tap/double left click, if any.
 * @property {ActionName[]} [button3] - actions assigned to long tab/long left click, if any.
 */

const logger = makeLogger('catalog-service')

/**
 * Computes a given player's catalog, only including free games and restricted games they can access.
 * @param {?Player} player - related player.
 * @returns {Promise<GameDescriptor[]>} the full list of catalog items for this player.
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
 * @param {?Player} player - related player.
 * @param {GameDescriptor} item - the checked catalog item.
 * @returns {boolean} true when the item is publicly available or if this player was granted access.
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
 * @returns {Promise<?Player>} saved player, or null
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
 * @returns {Promise<?Player>} saved player, or null
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
