import { readFileSync } from 'fs'
import fastify from 'fastify'

const { NODE_ENV } = process.env

const isProduction = /^\w*production\w*$/i.test(NODE_ENV)

function configure() {
  const url = isProduction ? { port: 443, host: '0.0.0.0' } : 3001
  const app = fastify({
    logger: { level: 'debug' },
    https: isProduction
      ? {
          key: readFileSync('keys/privkey.pem'),
          cert: readFileSync('keys/cert.pem')
        }
      : undefined
  })

  app.register(import('fastify-websocket'))
  app.register(import('./plugins/peer-signal.js'))
  app.register(import('./plugins/graphql.js'))
  app.register(import('./plugins/sse.js'))
  app.register(import('./plugins/client.js'))
  return { app, url }
}

async function start({ app, url }) {
  return app.listen(url)
}

start(configure())
