import staticPlugin from 'fastify-static'

/**
 * @typedef {object} StaticOptions Static content plugin options, including:
 * @param {string} opts.path - folder absolute path containing UI static files
 */

/**
 * Registers endpoints to serve the static game client.
 * @async
 * @param {import('fastify').FastifyInstance} app - a fastify application.
 * @param {StaticOptions} opts - plugin's options.
 */
async function registerClient(app, opts) {
  app.register(staticPlugin, { ...opts, root: opts.path })
}

export default registerClient
