import { isAbsolute, join, resolve } from 'path'
import { cwd } from 'process'
import staticPlugin from 'fastify-static'

/**
 * Registers endpoints to serve the ctatic client.
 * @param {fastify} app - a fastify application
 * @param {object} opts - plugin's options, including:
 * @param {string} [opts.path='apps/web/dist'] - path to the client files (relative path are resolved with current working directory)
 */
async function registerClient(app, opts) {
  let root = opts.path || join('apps', 'web', 'dist')
  if (!isAbsolute(root)) {
    root = resolve(cwd(), root)
  }
  app.register(staticPlugin, { root })
}

export default registerClient
