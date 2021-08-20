import { isAbsolute, resolve } from 'path'
import { cwd } from 'process'
import staticPlugin from 'fastify-static'

/**
 * @typedef {object} StaticOptions Static content plugin options, including:
 * @param {string} opts.path - path to the client files (relative path are resolved with current working directory)
 */

/**
 * Registers endpoints to serve the static game client.
 * @param {import('fastify').FastifyInstance} app - a fastify application.
 * @param {StaticOptions} opts - plugin's options.
 */
async function registerClient(app, opts) {
  const root = !isAbsolute(opts.path) ? resolve(cwd(), opts.path) : opts.path
  app.register(staticPlugin, { ...opts, root })
}

export default registerClient
