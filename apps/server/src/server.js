import { readFile } from 'fs/promises'
import fastify from 'fastify'
import repositories from './repositories'
const { games, players } = repositories

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
  await players.connect({ path: config.data.path })
  await games.connect({ path: config.data.path })

  app.register(import('fastify-websocket'), { maxPayload: 1048576 })
  app.register(import('./plugins/graphql.js'), config.plugins.graphql)
  app.register(import('./plugins/static.js'), config.plugins.static)

  await app.listen(config.serverUrl)
  return app
}
