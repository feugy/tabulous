// @ts-check
import { gql } from '@urql/core'
import chalkTemplate from 'chalk-template'

import {
  attachFormater,
  cliName,
  commonArgSpec,
  getGraphQLClient,
  parseArgv,
  signToken
} from '../util/index.js'
import { commonOptions } from './help.js'

/**
 * @typedef {object} DeletePlayerResult player deletion command result
 * @property {import('./add-player.js').Player} player - deleted player.
 */

const deletePlayerMutation = gql`
  mutation deletePlayerMutation($id: ID!) {
    deletePlayer(id: $id) {
      id
      email
      username
    }
  }
`

/**
 * Triggers player deletion command
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns {Promise<DeletePlayerResult|string>} the deleted player (or help message).
 */
export default async function deletePlayerCommand(argv) {
  const args = parseArgv(argv, {
    ...commonArgSpec
  })
  if (args.help) {
    return deletePlayerCommand.help()
  }
  const id = args.command?.[0]
  if (!id) {
    throw new Error('no player-id provided')
  }
  return deletePlayer({ id })
}

/**
 * @typedef {object} DeletePlayerArgs
 * @property {string} id - deleted player's id.
 */

/**
 * Deletes an existing player account.
 * @param {DeletePlayerArgs} args - deletion arguments.
 * @returns {Promise<DeletePlayerResult>} player deletion results.
 */
export async function deletePlayer({ id }) {
  const { deletePlayer: player } = await getGraphQLClient().mutation(
    deletePlayerMutation,
    { id },
    signToken()
  )
  return attachFormater({ player }, ({ player }) =>
    player
      ? chalkTemplate`{bold ${player.username}} {dim ${player.email}} (${player.id}) {underline deleted}`
      : chalkTemplate`{underline no player} deleted`
  )
}

deletePlayerCommand.help = function help() {
  return chalkTemplate`
  {bold ${cliName}} [options] delete-player [player-id]
  Deletes an existing player account
  {dim Options:}
    ${commonOptions}`
}
