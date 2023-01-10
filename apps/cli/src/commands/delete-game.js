// @ts-check
import { gql } from '@urql/core'
import chalkTemplate from 'chalk-template'

import {
  attachFormater,
  cliName,
  commonArgSpec,
  formatGame,
  getGraphQLClient,
  parseArgv,
  signToken
} from '../util/index.js'
import { commonOptions } from './help.js'

/**
 * @typedef {object} DeleteGameResult game deletion command result
 * @property {import('../util/formaters.js').Game} game - deleted game.
 */

const deleteGameMutation = gql`
  mutation deleteGameMutation($gameId: ID!) {
    deleteGame(gameId: $gameId) {
      id
      kind
      created
    }
  }
`

/**
 * Triggers game addition command
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns {Promise<DeleteGameResult|string>} the deleted game (or help message).
 */
export default async function deleteGameCommand(argv) {
  const args = parseArgv(argv, {
    ...commonArgSpec
  })
  if (args.help) {
    return deleteGameCommand.help()
  }
  const gameId = args.command?.[0]
  if (!gameId) {
    throw new Error('no game-id provided')
  }
  return deleteGame({ gameId })
}

/**
 * @typedef {object} DeleteGameArgs
 * @property {string} gameId - deleted game's id.
 */

/**
 * Adds a new player account.
 * @param {DeleteGameArgs} args - deletion arguments.
 * @returns {Promise<DeleteGameResult>} game deletion results.
 */
export async function deleteGame({ gameId }) {
  const { deleteGame: game } = await getGraphQLClient().mutation(
    deleteGameMutation,
    { gameId },
    signToken()
  )
  return attachFormater({ game }, ({ game }) =>
    game
      ? chalkTemplate`${formatGame(game)} {underline deleted}`
      : chalkTemplate`{bold no} game deleted`
  )
}

deleteGameCommand.help = function help() {
  return chalkTemplate`
  {bold ${cliName}} [options] delete-game [game-id]
  Deletes an existing game or lobby
  {dim Options:}
    ${commonOptions}`
}
