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

const revokeAccessMutation = gql`
  mutation revokeAccess($id: ID!, $gameName: ID!) {
    revokeAccess(playerId: $id, itemName: $gameName)
  }
`
/**
 * @typedef {object} RevokeAccessResult catalog item revoke command result.
 * @property {boolean} revokeAccess - whether the catalog item was revoked.
 */

/**
 * Triggers the revoke command.
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns whether the operation succeeded.
 */
export default async function revokeCommand(argv) {
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
    return revokeCommand.help()
  }
  return revoke({ username: args.username, gameName })
}

/**
 * @typedef {object} RevokeArgs
 * @property {string} username - name of the corresponding user.
 * @property {string} gameName - name of the granted game
 */

/**
 * Revoke game access to a player.
 * @param {RevokeArgs} args - username and game Name.
 * @returns whether the operation succeeded.
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

function formatRevokation(/** @type {RevokeAccessResult} */ { revokeAccess }) {
  return revokeAccess
    ? chalkTemplate`🚷 access {green revoked}\n`
    : chalkTemplate`🔶 {yellow no changes}\n`
}

revokeCommand.help = function help() {
  return chalkTemplate`
  {bold ${cliName}} [options] revoke [game-name]
  Revokes access to a copyrighted game
  {dim Commands:}
    [game-name]               Name of the revoked game
  {dim Options:}
    --username/-u             Username for which catalog is fetched
    ${commonOptions}`
}
