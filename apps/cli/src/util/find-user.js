// @ts-check
import { gql } from '@urql/core'
import { getGraphQLClient } from './graphql-client.js'
import { signToken } from './jwt.js'

const findUserQuery = gql`
  query findUserByUsername($username: String!) {
    searchPlayers(search: $username, includeCurrent: true) {
      id
      username
    }
  }
`

/**
 * Finds user details from their username
 * @param {string} username - desired username.
 * @returns {Promise<import('@tabulous/server/src/services/players').Player|null>} corresponding player, or null.
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
