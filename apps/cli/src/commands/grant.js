// @ts-check
import { gql } from '@urql/core'
import chalkTemplate from 'chalk-template'
import {
  attachFormater,
  findUser,
  getGraphQLClient,
  parseArgv,
  RequiredString,
  signToken
} from '../util/index.js'
import { catalog } from './catalog.js'

const grantAccessMutation = gql`
  mutation grantAccess($id: ID!, $gameName: ID!) {
    grantAccess(playerId: $id, itemName: $gameName)
  }
`

/**
 * Triggers grant command.
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns {Promise<Boolean>} whether the operation succeeded.
 */
export default async function grantCommand(argv) {
  const {
    username,
    command: [gameName]
  } = parseArgv(argv, {
    '--username': RequiredString,
    '-u': '--username'
  })
  if (!gameName) {
    throw new Error('no game-name provided')
  }
  return grant({ username, gameName })
}

/**
 * @typedef {object} GrantArgs
 * @property {string} username - name of the corresponding user.
 * @property {string} gameName - name of the granted game
 */

/**
 * Grant a player access to a copyrighted game.
 * @param {GrantArgs} args - username and game name.
 * @returns {Promise<Boolean>} whether the operation succeeded.
 */
export async function grant({ username, gameName }) {
  const client = getGraphQLClient()
  const { id } = await findUser(username)
  const { grantAccess } = await client.mutation(
    grantAccessMutation,
    { id, gameName },
    signToken()
  )
  return attachFormater(
    {
      grantAccess,
      ...(await catalog({ username }))
    },
    formatGrant,
    true
  )
}

function formatGrant({ grantAccess }) {
  return grantAccess
    ? chalkTemplate`🛣  access {green granted}\n`
    : chalkTemplate`🔶 {yellow no changes}\n`
}
