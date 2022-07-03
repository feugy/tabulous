import mercurius from 'mercurius'
import { schema, resolvers, loaders } from '../graphql/index.js'
import { getAuthenticatedPlayer } from './utils.js'

/**
 * @typedef {import('mercurius').MercuriusOptions} GraphQLOptions graphQL plugin options.
 * You can use any of Mercurius options but `schema`, `resolvers`, `loaders` and `context` which are computed.
 * @property {string} allowedOrigin - origin allowed for web socket connections
 */

/**
 * Registers Tabulous graphql endpoints (powered by mercurius) into the provided fastify application.
 * it provides context to resovers, with:
 * - the player object, as `player`
 * - the server full configuration, as `conf`
 * @async
 * @param {import('fastify').FastifyInstance} app - a fastify application.
 * @param {GraphQLOptions} opts - plugin options.
 */
export default async function registerGraphQL(app, opts) {
  app.register(mercurius, {
    ...opts,
    schema,
    resolvers,
    loaders,
    subscription: {
      async onConnect({ payload }) {
        const player = await getAuthenticatedPlayer(
          payload?.bearer.replace('Bearer ', ''),
          app.conf.auth.jwt.key
        )
        return { player, conf: app.conf }
      },
      // checks Origin header (https://appcheck-ng.com/cross-site-hijacking)
      verifyClient: ({ origin }) => origin === opts.allowedOrigin
    },
    context: async request => ({
      player: await getAuthenticatedPlayer(
        request.cookies.token,
        app.conf.auth.jwt.key
      ),
      token: request.cookies.token,
      conf: app.conf
    })
  })
}
