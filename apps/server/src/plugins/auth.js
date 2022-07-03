import services from '../services/index.js'
import { setTokenCookie } from './utils.js'

/**
 * @typedef {object} AuthOptions authentication plugin options, including:
 * @param {string} domain - Public facing domain (full url) for authentication redirections.
 * @param {import('fast-jwt').SignerOptions} jwt - options used to encrypt JWT token sent as cookies: needs 'key' at least.
 * @param {OAuth2ProviderOptions} github - Github authentication provider options.
 * @param {OAuth2ProviderOptions} google - Google authentication provider options.
 */

/**
 * @typedef {object} OAuth2ProviderOptions OAuth2 authentication options, including:
 * @param {string} id - client ID.
 * @param {string} secret - client secret.
 */

/**
 * Registers endpoint to handle player authentication with various authentication providers.
 * @async
 * @param {import('fastify').FastifyInstance} app - a fastify application.
 * @param {OAuth2ProviderOptions} options - plugin's options.
 */
export default async function registerAuth(app, options) {
  const { githubAuth, googleAuth, connect } = services

  for (const { service, provider } of [
    { service: githubAuth, provider: 'github' },
    { service: googleAuth, provider: 'google' }
  ]) {
    if (options[provider]) {
      service.init({
        ...options[provider],
        redirect: `${options.domain}${
          options.prefix ?? ''
        }/${provider}/callback`
      })

      app.get(`/${provider}/connect`, ({ query: { redirect } }, reply) =>
        reply.redirect(service.buildAuthUrl(redirect).toString())
      )

      app.get(
        `/${provider}/callback`,
        async ({ query: { code, state } }, reply) => {
          const { location, user } = await service.authenticateUser(code, state)
          const player = await connect({ ...user, provider })
          setTokenCookie(reply, player, options.jwt)
          return reply.redirect(location)
        }
      )
    }
  }
}
