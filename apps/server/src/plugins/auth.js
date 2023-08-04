// @ts-check
/**
 * @typedef {import('fastify').FastifyInstance} FastifyInstance
 * @typedef {import('../services/auth/oauth2').ProviderInit} ProviderInit
 * @typedef {import('./utils').SignerOptions} SignerOptions
 */

import services from '../services/index.js'
import { addToLogContext, makeLogger } from '../utils/index.js'
import { makeToken } from './utils.js'

/**
 * @typedef {object} AuthOptions authentication plugin options, including:
 * @property {string} domain - public facing domain (full url) for authentication redirections.
 * @property {string} allowedOrigins - regular expression for allowed domains during authentication.
 * @property {SignerOptions} jwt - options used to encrypt JWT token: needs 'key' at least.
 * @property {Omit<ProviderInit, 'redirect'>} [github] - Github authentication provider options.
 * @property {Omit<ProviderInit, 'redirect'>} [google] - Google authentication provider options.
 */

const logger = makeLogger('auth-plugin')

/**
 * Registers endpoint to handle player authentication with various authentication providers.
 * @param {FastifyInstance} app - a fastify application.
 * @param {AuthOptions} options - plugin's options.
 * @returns {Promise<void>}
 */
export default async function registerAuth(app, options) {
  const { githubAuth, googleAuth, upsertPlayer } = services
  const allowedOriginsRegExp = new RegExp(options.allowedOrigins)

  for (const provider of [githubAuth, googleAuth]) {
    const name = /** @type {'github'|'google'} */ (provider.name)
    if (name in options) {
      provider.init({
        .../** @type {ProviderInit} */ (options[name]),
        redirect: `${options.domain}/${name}/callback`
      })

      app.get(
        `/${name}/connect`,
        // @ts-expect-error: Property 'redirect' does not exist on type 'unknown'
        ({ query: { redirect }, hostname, protocol }, reply) => {
          addToLogContext({ authProvider: name })
          const origin = `${protocol}://${hostname}`
          logger.trace(
            { ctx: { redirect, origin } },
            'connects with auth provider'
          )
          if (!allowedOriginsRegExp.test(origin)) {
            return reply.code(401).send({ error: `Forbidden origin ${origin}` })
          }
          if (redirect && !allowedOriginsRegExp.test(redirect)) {
            return reply
              .code(401)
              .send({ error: `Forbidden redirect domain ${redirect}` })
          }
          const url = provider.buildAuthUrl(redirect ?? origin).toString()
          logger.debug(
            { ctx: { redirect, origin }, res: url },
            'connected with auth provider'
          )
          return reply.redirect(url)
        }
      )

      app.get(
        `/${name}/callback`,
        // @ts-expect-error: Property 'code', 'state' does not exist on type 'unknown'
        async ({ query: { code, state } }, reply) => {
          addToLogContext({ authProvider: name })
          logger.trace('handles auth provider callback')
          const { location, user } = await provider.authenticateUser(
            code,
            state
          )
          const player = await upsertPlayer({ ...user, provider: name })
          const url = new URL(location)
          url.searchParams.append('token', makeToken(player, options.jwt))
          logger.debug(
            { res: url.toString() },
            'handled auth provider callback'
          )
          return reply.redirect(url.toString())
        }
      )

      logger.debug({ res: name }, 'registered authentication provider')
    }
  }
}
