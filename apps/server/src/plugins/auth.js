import services from '../services/index.js'
import { setTokenCookie } from './utils.js'

/**
 * @typedef {object} AuthOptions authentication plugin options, including:
 * @param {string} domain - public facing domain (full url) for authentication redirections.
 * @param {string} allowedOrigins - regular expression for allowed domains during authentication.
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
  const allowedOriginsRegExp = new RegExp(options.allowedOrigins)

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

      app.get(
        `/${provider}/connect`,
        ({ query: { redirect }, hostname, protocol }, reply) => {
          const origin = `${protocol}://${hostname}`
          if (!allowedOriginsRegExp.test(origin)) {
            return reply.code(401).send({ error: `Forbidden origin ${origin}` })
          }
          return reply.redirect(
            service.buildAuthUrl(`${origin}${redirect ?? '/'}`).toString()
          )
        }
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
