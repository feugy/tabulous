// @ts-check
import { gql } from '@urql/core'

import { getGraphQLClient } from './graphql-client.js'
import { signToken } from './jwt.js'

const findUserQuery = gql`
  query findUserByUsername($username: String!) {
    searchPlayers(search: $username, includeCurrent: true) {
      id
      isAdmin
      username
      email
      avatar
      provider
      termsAccepted
      currentGameId
    }
  }
`

/**
 * @overload
 * Finds user details from their username
 * @param {string} username - desired username.
 * @param {boolean} [throwOnNull=true] - whether to throw an error when no player could be found.
 * @returns {Promise<import('@tabulous/types').Player>} corresponding player.
 * @throws {Error} when failOnNull is true, and no player could be found
 *
 * @overload
 * Finds user details from their username
 * @param {string} username - desired username.
 * @param {false} throwOnNull - whether to throw an error when no player could be found.
 * @returns {Promise<?import('@tabulous/types').Player>} corresponding player, or null.
 */
export async function findUser(
  /** @type {string} */ username,
  throwOnNull = true
) {
  const client = getGraphQLClient()
  const { searchPlayers } = await client.query(
    findUserQuery,
    { username },
    signToken()
  )
  const user = /** @type {?import('@tabulous/types').Player} */ (
    searchPlayers?.[0] ?? null
  )
  if (!user && throwOnNull) {
    throw new Error(`no user found`)
  }
  return user
}
