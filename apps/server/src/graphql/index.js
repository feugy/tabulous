import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadSchemaSync } from '@graphql-tools/load'
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import merge from 'deepmerge'
import gameResolvers from './games-resolver.js'
import playerResolvers from './players-resolver.js'

export const schema = loadSchemaSync(['./players.graphql', './games.graphql'], {
  cwd: dirname(fileURLToPath(import.meta.url)),
  loaders: [new GraphQLFileLoader()]
})

export const resolvers = merge.all([gameResolvers, playerResolvers])
