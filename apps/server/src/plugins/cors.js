// @ts-check
import corsPlugin from '@fastify/cors'

/**
 * @typedef {object} CorsOptions CORS plugin options, including:
 * @property {string} allowedOrigins - regular expression for allowed domains for CORS.
 */

/**
 * Registers endpoints to handle CORS requests.
 * @async
 * @param {import('fastify').FastifyInstance} app - a fastify application.
 * @param {CorsOptions} opts - plugin's options.
 */
export default async function registerCors(app, opts) {
  const origin = new RegExp(opts.allowedOrigins)
  app.register(corsPlugin, {
    origin,
    methods: ['GET', 'POST'],
    maxAge: 120,
    strictPreflight: true,
    credentials: true
  })
}
// needed so that CORS applies on all routes in all plugins
// @ts-ignore
registerCors[Symbol.for('skip-override')] = true
