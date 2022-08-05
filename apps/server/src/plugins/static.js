import staticPlugin from '@fastify/static'

/**
 * @typedef {object} StaticOptions Static content plugin options, including:
 * @property {string} path - folder absolute path containing static files
 * @property {string} pathPrefix - URL path prefix for the static directory
 */

/**
 * Registers endpoints to serve the static game client.
 * @async
 * @param {import('fastify').FastifyInstance} app - a fastify application.
 * @param {StaticOptions} opts - plugin's options.
 */
export default async function registerStatic(app, opts) {
  app.register(staticPlugin, {
    ...opts,
    prefix: opts.pathPrefix,
    root: opts.path
  })
}
