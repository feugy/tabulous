// @ts-check
import mercurius from 'mercurius'
import redis from 'mqemitter-redis'

import { loaders, resolvers, schema } from '../graphql/resolvers.js'
import { addToLogContext, makeLogger } from '../utils/index.js'
import { getAuthenticatedPlayer } from './utils.js'

const logger = makeLogger('graphql-plugin')

/**
 * @typedef {object} GraphQLCustomOptions
 * @property {string} allowedOrigins - regular expression for allowed domains during web socket connections
 * @property {string} pubsubUrl - regular expression for allowed domains during web socket connections
 */

/**
 * @typedef {object} Context Context passed to every GraphQL resolver.
 * @property {?import('@tabulous/types').Player} player - authenticated player, if any.
 * @property {string} token - authentication token (could be empty).
 * @property {import('@src/services/configuration').Configuration} conf - application configuration.
 */

/** @typedef {import('mercurius').MercuriusContext & Context} GraphQLContext */

/**
 * @typedef {import('mercurius').MercuriusOptions & GraphQLCustomOptions} Options graphQL plugin options.
 * You can use any of Mercurius options but `schema`, `resolvers`, `loaders` and `context` which are computed.
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
 * @param {import('fastify').FastifyInstance} fastify - a fastify application.
 * @param {Options} opts - plugin options.
 */
export default async function registerGraphQL(
  fastify,
  { allowedOrigins, pubsubUrl, ...opts }
) {
  const allowedOriginsRegExp = new RegExp(allowedOrigins)
  const app = /** @type {import('@src/server').Server} */ (fastify)
  await app.register(mercurius, {
    ...opts,
    schema,
    resolvers,
    loaders,
    subscription: {
      emitter: redis({ connectionString: pubsubUrl, enableReadyCheck: false }),
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
    context: async ({ headers, body }) => {
      const token = extractBearer(headers.authorization)
      const player = await getAuthenticatedPlayer(token, app.conf.auth.jwt.key)
      addToLogContext({
        graphql: {
          // @ts-expect-error -- 'body' is of type 'unknown'
          operation: body.operationName,
          // @ts-expect-error -- 'body' is of type 'unknown'
          variables: body.variables,
          currentPlayer: player && { id: player.id, username: player.username }
        }
      })
      return { player, token, conf: app.conf }
    },
    errorFormatter: (execution, context) => {
      logger.warn({ errors: execution.errors }, 'graphQL errors')
      const response = mercurius.defaultErrorFormatter(execution, context)
      response.statusCode = 200
      return response
    }
  })
}

function extractBearer(/** @type {string|undefined} */ value) {
  return (value ?? '').replace('Bearer ', '')
}
