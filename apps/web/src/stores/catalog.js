// @ts-check
/**
 * @typedef {import('@tabulous/server/src/graphql').CatalogItem} CatalogItem
 */

import * as graphQL from '@src/graphql'
import { get } from 'svelte/store'

import { makeLogger } from '../utils'
import { runQuery } from './graphql-client'
import { buildLocaleComparator } from './locale'

const logger = makeLogger('players')

/**
 * List all catalog items.
 * @returns {Promise<CatalogItem[]>} a list of catalog items.
 */
export async function listCatalog() {
  logger.info('list catalog')
  const byTitle = get(buildLocaleComparator('locales.$locale.title'))
  return (await runQuery(graphQL.listCatalog)).sort(byTitle)
}
