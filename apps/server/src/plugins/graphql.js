import mercurius from 'mercurius'
import redis from 'mqemitter-redis'

import { loaders, resolvers, schema } from '../graphql/index.js'
import { getAuthenticatedPlayer } from './utils.js'

/**
 * @typedef {import('mercurius').MercuriusOptions} GraphQLOptions graphQL plugin options.
 * You can use any of Mercurius options but `schema`, `resolvers`, `loaders` and `context` which are computed.
 * @property {string} allowedOrigin - regular expression for allowed domains during web socket connections
 * @property {string} pubsubUrl - regular expression for allowed domains during web socket connections
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
export default async function registerGraphQL(
  app,
  { allowedOrigins, pubsubUrl, ...opts }
) {
  const allowedOriginsRegExp = new RegExp(allowedOrigins)
  await app.register(mercurius, {
    ...opts,
    schema,
    resolvers,
    loaders,
    subscription: {
      emitter: redis({ connectionString: pubsubUrl }),
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
    },
    errorFormatter: (execution, context) => {
      for (const error of execution.errors) {
        console.warn(error.stack)
      }
      const response = mercurius.defaultErrorFormatter(execution, context)
      response.statusCode = 200
      return response
    }
  })
}

function extractBearer(value) {
  return (value ?? '').replace('Bearer ', '')
}
