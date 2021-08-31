import mercurius from 'mercurius'
import { schema, resolvers, loaders } from '../graphql/index.js'
import { getAuthenticatedPlayer } from './utils.js'

/**
 * @typedef {import('mercurius').MercuriusOptions} GraphQLOptions graphQL plugin options.
 * You can use any of Mercurius options but `schema`, `resolvers`, `loaders` and `context` which are computed.
 */

/**
 * Registers Tabulous graphql endpoints (powered by mercurius) into the provided fastify application.
 * @async
 * @param {import('fastify').FastifyInstance} app - a fastify application.
 * @param {GraphQLOptions} opts - plugin options.
 */
async function registerGraphQL(app, opts) {
  app.register(mercurius, {
    ...opts,
    schema,
    resolvers,
    loaders,
    subscription: {
      async onConnect({ payload }) {
        const player = await getAuthenticatedPlayer(payload?.bearer)
        return player ? { player } : null
      }
    },
    context: async request => ({
      player: await getAuthenticatedPlayer(request.headers.authorization)
    })
  })
}

export default registerGraphQL
