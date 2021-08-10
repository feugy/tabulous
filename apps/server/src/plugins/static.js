import { isAbsolute, resolve } from 'path'
import { cwd } from 'process'
import staticPlugin from 'fastify-static'

/**
 * Registers endpoints to serve the ctatic client.
 * @param {fastify} app - a fastify application
 * @param {object} opts - plugin's options, including:
 * @param {string} opts.path - path to the client files (relative path are resolved with current working directory)
 */
async function registerClient(app, opts) {
  const root = !isAbsolute(opts.path) ? resolve(cwd(), opts.path) : opts.path
  app.register(staticPlugin, { ...opts, root })
}

export default registerClient
