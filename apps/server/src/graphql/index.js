import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import merge from 'deepmerge'
import catalogResolvers from './catalog-resolver.js'
import gameResolvers from './games-resolver.js'
import playerResolvers from './players-resolver.js'
import signalResolvers from './signals-resolver.js'
import { readFileSync } from 'fs'

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
  gameResolvers,
  playerResolvers,
  signalResolvers
])

export { schema, resolvers, loaders }

function loadTypeDefs(fileName) {
  return readFileSync(join(folder, fileName)).toString()
}
