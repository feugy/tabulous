import merge from 'deepmerge'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import catalogResolvers from './catalog-resolver.js'
import gamesResolvers from './games-resolver.js'
import playersResolvers from './players-resolver.js'
import signalsResolvers from './signals-resolver.js'

const folder = dirname(fileURLToPath(import.meta.url))

const schema = [
  // order matters because of type extension
  'players.graphql',
  'signals.graphql',
  'catalog.graphql',
  'games.graphql'
].map(loadTypeDefs)

const { loaders, ...resolvers } = merge.all([
  catalogResolvers,
  gamesResolvers,
  playersResolvers,
  signalsResolvers
])

export { loaders, resolvers, schema }

function loadTypeDefs(fileName) {
  return readFileSync(join(folder, fileName)).toString()
}
