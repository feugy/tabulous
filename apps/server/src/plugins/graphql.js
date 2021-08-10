import mercurius from 'mercurius'
import { schema, resolvers, loaders } from '../graphql/index.js'
import { getAuthenticatedPlayer } from './utils.js'

/**
 * Registers Tabulous graphql endpoints (powered by mercurius) into the provided fastify application.
 * @param {fastify} app - a fastify application
 * @param {object} opts - mercurius options
 */
async function registerGraphQL(app, opts) {
  app.register(mercurius, {
    schema,
    resolvers,
    loaders,
    graphiql: 'playground',
    context: async request => ({
      player: await getAuthenticatedPlayer(request.headers.authorization)
    }),
    ...opts
  })
}

export default registerGraphQL
