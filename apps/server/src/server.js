import { readFile } from 'fs/promises'
import fastify from 'fastify'

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

  app.register(import('fastify-websocket'), { maxPayload: 1048576 })
  app.register(import('./plugins/graphql.js'), config.plugins.graphql)
  app.register(import('./plugins/static.js'), config.plugins.static)
  return app.listen(config.serverUrl)
}
