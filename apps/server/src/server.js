import fastify from 'fastify'

function configure() {
  const app = fastify({ logger: { level: 'info' } })

  app.register(import('fastify-cors'), { origin: 'http://localhost:3000' })
  app.register(import('fastify-websocket'))
  app.register(import('./plugins/peer-signal.js'))
  app.register(import('./plugins/graphql.js'))
  app.register(import('./plugins/sse.js'))
  return app
}

async function start(app, port = 3001) {
  return app.listen(port)
}

start(configure())
