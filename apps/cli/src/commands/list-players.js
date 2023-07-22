// @ts-check
/** @typedef {import('@tabulous/server/src/graphql/types').Player} Player */

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
 * @returns {Promise<Player[]|string>} list of players or help message.
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
 * @returns {Promise<Player[]>} list of players.
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

/**
 * @param {number} from
 * @param {number} size
 */
function makeListPlayersQuery(from, size) {
  return gql`
    query listGamesQuery {
      listPlayers(from: ${from.toString()}, size: ${size.toString()}) {
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

/**
 * @param {Player[]} players
 * @returns {string} - formatted result
 */
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
