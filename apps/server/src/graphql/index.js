import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadSchemaSync } from '@graphql-tools/load'
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import merge from 'deepmerge'
import catalogResolvers from './catalog-resolver.js'
import gameResolvers from './games-resolver.js'
import playerResolvers from './players-resolver.js'
import signalResolvers from './signals-resolver.js'

/**
 * Synchronously loaded GraphQL schemas for players, games and signals.
 */
export const schema = loadSchemaSync(
  [
    './catalog.graphql',
    './players.graphql',
    './games.graphql',
    './signals.graphql'
  ],
  {
    cwd: dirname(fileURLToPath(import.meta.url)),
    loaders: [new GraphQLFileLoader()]
  }
)

/**
 * Loaders and resolvers for players, games and signals.
 */
const { loaders, ...resolvers } = merge.all([
  catalogResolvers,
  gameResolvers,
  playerResolvers,
  signalResolvers
])

export { resolvers, loaders }
