import mercurius from 'mercurius'
import { schema, resolvers } from '../graphql/index.js'
import { getPlayerById } from '../services/index.js'

/**
 * Registers Tabulous graphql endpoints (powered by mercurius) into the provided fastify application.
 * @param {fastify} app - a fastify application
 * @param {object} opts - mercurius options
 */
async function registerGraphQL(app, opts) {
  app.register(mercurius, {
    schema,
    resolvers,
    graphiql: 'playground',
    context: async request => {
      const token = request.headers.authorization
      let player = null
      if (token && token.startsWith('Bearer ')) {
        const id = token.replace('Bearer ', '')
        player = await getPlayerById(id)
      }
      return { player }
    },
    ...opts
  })
}

export default registerGraphQL
