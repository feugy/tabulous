// @ts-check
import { gql } from '@urql/core'
import chalkTemplate from 'chalk-template'

import {
  attachFormater,
  cliName,
  commonArgSpec,
  formatPlayer,
  getGraphQLClient,
  parseArgv,
  signToken
} from '../util/index.js'
import { commonOptions } from './help.js'

/**
 * Triggers player list command.
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns {Promise<import('../util/formaters.js').Player[]|string>} list of players or help message.
 */
export default async function listPlayersCommand(argv) {
  const args = parseArgv(argv, commonArgSpec)
  if (args.help) {
    return listPlayersCommand.help()
  }
  return listPlayers()
}

/**
 * Fetches all pages of the player list
 * @returns {Promise<import('../util/formaters.js').Player[]>} list of players.
 */
export async function listPlayers() {
  let from = 0
  const size = 20
  let total = Number.POSITIVE_INFINITY
  const players = []
  while (from < total) {
    const { listPlayers: page } = await getGraphQLClient().query(
      makeListPlayersQuery(from, size),
      signToken()
    )
    total = page.total
    from += size
    players.push(...page.results)
  }

  return attachFormater(players, formatPlayers)
}

function makeListPlayersQuery(from, size) {
  return gql`
    query listGamesQuery {
      listPlayers(from: ${from}, size: ${size}) {
        total
        from
        size
        results {
          id
          email
          username
        }
      }
    }
  `
}

function formatPlayers(players) {
  return players.map(player => `- ${formatPlayer(player)}`).join('\n')
}

listPlayersCommand.help = function help() {
  return chalkTemplate`
  {bold ${cliName}} [options] list-players
  List all existing player accounts
  {dim Options:}
    ${commonOptions}`
}