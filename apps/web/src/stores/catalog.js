import { get } from 'svelte/store'

import * as graphQL from '../graphql'
import { makeLogger } from '../utils'
import { runQuery } from './graphql-client'
import { buildLocaleComparator } from './locale'

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
  const byTitle = get(buildLocaleComparator('locales.$locale.title'))
  return (await runQuery(graphQL.listCatalog)).sort(byTitle)
}
