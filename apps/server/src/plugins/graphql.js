import mercurius from 'mercurius'
import { schema, resolvers, loaders } from '../graphql/index.js'
import { getAuthenticatedPlayer } from './utils.js'

/**
 * @typedef {import('mercurius').MercuriusOptions} GraphQLOptions graphQL plugin options.
 * You can use any of Mercurius options but `schema`, `resolvers`, `loaders` and `context` which are computed.
 * @property {string} allowedOrigin - regular expression for allowed domains during web socket connections
 */

/**
 * Registers Tabulous graphql endpoints (powered by mercurius) into the provided fastify application.
 * it provides context to resovers, with:
 * - the player object, as `player`
 * - the server full configuration, as `conf`
 * - the JWT token, if any, as `token`
 * Request authentication expects a Bearer token ("Bearer " + a valid JWT).
 * In the case of GraphQL subscription, bearer is expected on the connection payload message.
 * In the case of GraphQL queries and mutations, bearer is expected in the Authorization header
 * @async
 * @param {import('fastify').FastifyInstance} app - a fastify application.
 * @param {GraphQLOptions} opts - plugin options.
 */
export default async function registerGraphQL(app, opts) {
  const allowedOriginsRegExp = new RegExp(opts.allowedOrigins)
  app.register(mercurius, {
    ...opts,
    schema,
    resolvers,
    loaders,
    subscription: {
      async onConnect({ payload }) {
        const player = await getAuthenticatedPlayer(
          extractBearer(payload?.bearer),
          app.conf.auth.jwt.key
        )
        return { player, conf: app.conf }
      },
      // checks Origin header (https://appcheck-ng.com/cross-site-hijacking)
      verifyClient: ({ origin }) => allowedOriginsRegExp.test(origin)
    },
    context: async request => {
      const token = extractBearer(request.headers.authorization)
      return {
        player: await getAuthenticatedPlayer(token, app.conf.auth.jwt.key),
        token,
        conf: app.conf
      }
    }
  })
}

function extractBearer(value) {
  return (value ?? '').replace('Bearer ', '')
}
