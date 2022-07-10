import Ajv from 'ajv/dist/jtd.js'

const validate = new Ajv({ allErrors: true }).compile({
  properties: {
    url: { type: 'string' },
    jwt: {
      properties: {
        key: { type: 'string' }
      }
    },
    adminUserId: { type: 'string' }
  }
})

/**
 * @typedef {object} Configuration loaded configuration, including:
 * @property {string} url - full url of tabulous server.
 * @property {object} jwt - configuration for JWT signing:
 * @property {string} jwt.key - key used for signing JWT.
 * @property {string} adminUserId - user id used to run elevated graphQL queries.
 */

/**
 * Synchronously loads and validates configuration from environment variables:
 * - URL: full url of the tabulous server.
 * - JWT_KEY: key used to sign JWT sent to the client.
 * - ADMIN_USER_ID: user id used to run elevated graphQL queries.
 *
 * @returns {Configuration} the loaded configuration.
 * @throws {Error} when the provided environment variables do not match expected values.
 */
export function loadConfiguration() {
  const { URL, JWT_KEY, ADMIN_USER_ID } = process.env

  const configuration = {
    url: URL,
    jwt: { key: JWT_KEY },
    adminUserId: ADMIN_USER_ID
  }

  if (!validate(configuration)) {
    throw new Error(
      validate.errors.reduce(
        (message, error) =>
          `${message}\n${error.instancePath} ${error.message}`,
        ''
      )
    )
  }
  return configuration
}
