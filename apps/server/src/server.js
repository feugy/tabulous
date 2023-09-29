// @ts-check
import fastify from 'fastify'

import * as repositories from './repositories/index.js'
import { createLogContext } from './utils/index.js'

/** @typedef {import('fastify').FastifyInstance & { conf: import('./services/configuration').Configuration }} Server */

/**
 * Starts Tabulous server, using provided configuration.
 * Server has graphQL endpoints registered, and can serve static files.
 * Its configuration object is available as a decorator: the `conf` property.
 * It connects all repositories.
 * @param {import('./services/configuration').Configuration} config - server options
 * @returns configured and started server.
 */
export async function startServer(config) {
  const app = fastify({
    logger: config.logger,
    disableRequestLogging: true
  })
  app.log.info('starting server')

  app.addHook('onRequest', async ({ id, method, url, query }) => {
    createLogContext({ req: { id, method, url, query } })
  })

  app.decorate('conf', config)
  await repositories.players.connect(config.data)
  await repositories.games.connect(config.data)
  await repositories.catalogItems.connect(config.games)

  app.register(import('./plugins/cors.js'), config.plugins.cors)
  app.register(import('./plugins/graphql.js'), config.plugins.graphql)
  app.register(import('./plugins/static.js'), config.plugins.static)
  app.register(import('./plugins/auth.js'), { prefix: '/auth', ...config.auth })

  await app.listen(config.serverUrl)
  app.log.info({ res: app.server.address() }, 'started server')
  // @ts-expect-error -- TS does not recognize fastify decorators
  return /** @type {Server} */ (app)
}
