import { runQuery } from './graphql-client'
import * as graphQL from '../graphql'
import { makeLogger } from '../utils'

const logger = makeLogger('players')

/**
 * @typedef {object} CatalogItem a catalog item
 * @property {string} name - item unique name.
 */

/**
 * List all catalog items.
 * @returns {Promise<CatalogItem[]>} a list of catalog items.
 */
export async function listCatalog() {
  logger.info('list catalog')
  return runQuery(graphQL.listCatalog)
}
