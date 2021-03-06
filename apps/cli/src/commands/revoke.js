// @ts-check
import { gql } from '@urql/core'
import chalkTemplate from 'chalk-template'
import {
  attachFormater,
  commonArgSpec,
  findUser,
  getGraphQLClient,
  parseArgv,
  RequiredString,
  signToken
} from '../util/index.js'
import { catalog } from './catalog.js'

const revokeAccessMutation = gql`
  mutation revokeAccess($id: ID!, $gameName: ID!) {
    revokeAccess(playerId: $id, itemName: $gameName)
  }
`
/**
 * Triggers the revoke command.
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns {Promise<Boolean>} whether the operation succeeded.
 */
export default async function revokeCommand(argv) {
  const {
    username,
    command: [gameName]
  } = parseArgv(argv, {
    ...commonArgSpec,
    '--username': RequiredString,
    '-u': '--username'
  })
  if (!gameName) {
    throw new Error('no game-name provided')
  }
  return revoke({ username, gameName })
}

/**
 * @typedef {object} RevokeArgs
 * @property {string} username - name of the corresponding user.
 * @property {string} gameName - name of the granted game
 */

/**
 * Revoke game access to a player.
 * @param {RevokeArgs} args - username and game Name.
 * @returns {Promise<Boolean>} whether the operation succeeded.
 */
export async function revoke({ username, gameName }) {
  const client = getGraphQLClient()
  const { id } = await findUser(username)
  const { revokeAccess } = await client.mutation(
    revokeAccessMutation,
    { id, gameName },
    signToken()
  )
  return attachFormater(
    {
      revokeAccess,
      ...(await catalog({ username }))
    },
    formatRevokation,
    true
  )
}

function formatRevokation({ revokeAccess }) {
  return revokeAccess
    ? chalkTemplate`🚷 access {green revoked}\n`
    : chalkTemplate`🔶 {yellow no changes}\n`
}
