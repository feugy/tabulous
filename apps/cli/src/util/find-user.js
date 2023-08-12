// @ts-check
/** @typedef {import('@tabulous/server/src/graphql').Player} Player */

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
 * Finds user details from their username
 * @param {string} username - desired username.
 * @param {boolean} [failOnNull = true] - whether to throw an error when no player could be found.
 * @returns {Promise<Player>} corresponding player, or null.
 * @throws {Error} when failOnNull is true, and no player could be found
 */
export async function findUser(username, failOnNull = true) {
  const client = getGraphQLClient()
  const { searchPlayers } = await client.query(
    findUserQuery,
    { username },
    signToken()
  )
  const user = searchPlayers?.[0] ?? null
  if (!user && failOnNull) {
    throw new Error(`no user found`)
  }
  return user
}
