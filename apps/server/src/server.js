import { readFile } from 'fs/promises'
import fastify from 'fastify'
import repositories from './repositories/index.js'

/**
 * Starts Tabulous server, using provided configuration.
 * Server has graphQL endpoints registered, and can serve static files.
 * Its configuration object is available as a decorator: the `conf` property.
 * It connects all repositories.
 * @async
 * @param {import('./services/configuration').Configuration} config - server options
 * @returns {import('fastify').FastifyInstance} configured and started server.
 */
export async function startServer(config) {
  const app = fastify({
    logger: config.logger,
    https: config.https
      ? {
          key: await readFile(config.https.key),
          cert: await readFile(config.https.cert)
        }
      : undefined
  })

  app.decorate('conf', config)
  await repositories.players.connect({ path: config.data.path })
  await repositories.games.connect({ path: config.data.path })
  await repositories.catalogItems.connect({ path: config.games.path })

  app.register(import('@fastify/cookie'), { secret: config.auth.jwt.key })
  app.register(import('./plugins/graphql.js'), config.plugins.graphql)
  app.register(import('./plugins/static.js'), config.plugins.static)
  app.register(import('./plugins/auth.js'), { prefix: '/auth', ...config.auth })

  await app.listen(config.serverUrl)
  return app
}
