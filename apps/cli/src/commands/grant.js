// @ts-check
import { gql } from '@urql/core'
import chalkTemplate from 'chalk-template'

import {
  attachFormater,
  cliName,
  commonArgSpec,
  findUser,
  getGraphQLClient,
  parseArgv,
  RequiredString,
  signToken
} from '../util/index.js'
import { catalog } from './catalog.js'
import { commonOptions } from './help.js'

const grantAccessMutation = gql`
  mutation grantAccess($id: ID!, $gameName: ID!) {
    grantAccess(playerId: $id, itemName: $gameName)
  }
`

/**
 * Triggers grant command.
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns {Promise<Boolean|string>} whether the operation succeeded.
 */
export default async function grantCommand(argv) {
  const args = parseArgv(argv, {
    ...commonArgSpec,
    '--username': RequiredString,
    '-u': '--username'
  })
  const gameName = args.command?.[0]
  if (!gameName) {
    throw new Error('no game-name provided')
  }
  if (args.help) {
    return grantCommand.help()
  }
  return grant({ username: args.username, gameName })
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

grantCommand.help = function help() {
  return chalkTemplate`
  {bold ${cliName}} [options] grant [game-name]
  Grants access to a copyrighted game
  {dim Commands:}
    [game-name]               Name of the granted game
  {dim Options:}
    --username/-u             Username for which catalog is fetched
    ${commonOptions}`
}
