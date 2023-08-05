// @ts-check
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import merge from 'deepmerge'

import catalogResolvers from './catalog-resolver.js'
import gamesResolvers from './games-resolver.js'
import loggerResolvers from './logger-resolver.js'
import playersResolvers from './players-resolver.js'
import signalsResolvers from './signals-resolver.js'

const folder = dirname(fileURLToPath(import.meta.url))

const schema = [
  // order matters because of type extension
  'players.graphql',
  'signals.graphql',
  'catalog.graphql',
  'games.graphql',
  'logger.graphql'
].map(loadTypeDefs)

// @ts-ignore
const { loaders, ...resolvers } = merge.all([
  catalogResolvers,
  gamesResolvers,
  playersResolvers,
  signalsResolvers,
  loggerResolvers
])

export { loaders, resolvers, schema }

/**
 * @param {string} fileName - loaded file
 * @returns {string} file content
 */
function loadTypeDefs(fileName) {
  return readFileSync(join(folder, fileName)).toString()
}
