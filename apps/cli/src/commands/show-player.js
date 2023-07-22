// @ts-check
/**
 * @typedef {import('@tabulous/server/src/graphql/types').Game} Game
 * @typedef {import('@tabulous/server/src/graphql/types').Player} Player
 */

import { gql } from '@urql/core'
import chalkTemplate from 'chalk-template'

import {
  attachFormater,
  cliName,
  commonArgSpec,
  findUser,
  formatGame,
  getGraphQLClient,
  parseArgv,
  RequiredString,
  signToken
} from '../util/index.js'
import { commonOptions } from './help.js'

const listGamesQuery = gql`
  query listGamesQuery {
    listGames {
      id
      kind
      created
      players {
        id
        isOwner
      }
    }
  }
`

/**
 * Triggers show player command.
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns {Promise<Player | string>} whether the operation succeeded.
 */
export default async function showPlayerCommand(argv) {
  const args = parseArgv(argv, {
    ...commonArgSpec,
    '--username': RequiredString,
    '-u': '--username'
  })
  if (args.help) {
    return showPlayerCommand.help()
  }
  return showPlayer(args)
}

/**
 * @typedef {object} ShowPlayerArgs
 * @property {string} username - name of the corresponding user
 */

/**
 * Show a player's details.
 * @param {ShowPlayerArgs} args - username.
 * @returns {Promise<Player>} found player details.
 */
export async function showPlayer({ username }) {
  const player = attachFormater(await findUser(username), formatPlayer)
  const { listGames: games } = await getGraphQLClient().query(
    listGamesQuery,
    signToken(player.id)
  )
  return attachFormater(
    {
      ...player,
      games
    },
    formatGames
  )
}

/**
 * @param {Player} result
 * @returns {string} formatted results
 */
function formatPlayer({
  id,
  isAdmin,
  username,
  email,
  provider,
  currentGameId,
  termsAccepted
}) {
  return chalkTemplate`{dim id:}             ${id} ${isAdmin ? '🥷' : ''}
{dim username:}       ${username}
{dim email:}          ${email || 'none'}
{dim provider:}       ${provider || 'manual'}
{dim terms accepted:} ${!!termsAccepted}
{dim is playing:}     ${currentGameId || 'none'}`
}

const spacing = '\n                '

/**
 * @param {Player & {games: Game[]}} result
 * @returns {string} formatted results
 */
function formatGames({ id: playerId, games }) {
  const { owned, invited } = games.reduce(
    (counts, game) => {
      if (game.players?.find(({ id, isOwner }) => isOwner && id === playerId)) {
        counts.owned.push(game)
      } else {
        counts.invited.push(game)
      }
      return counts
    },
    { owned: /** @type {Game[]} */ ([]), invited: /** @type {Game[]} */ ([]) }
  )
  owned.sort(byCreatedDate)
  invited.sort(byCreatedDate)
  return chalkTemplate`
{dim total games:}    ${games.length}
{dim owned games:}    ${owned.length}${
    owned.length > 0 ? spacing + owned.map(formatGame).join(spacing) : ''
  }
{dim invited games:}  ${invited.length}${
    invited.length > 0 ? spacing + invited.map(formatGame).join(spacing) : ''
  }`
}

showPlayerCommand.help = function help() {
  return chalkTemplate`
  {bold ${cliName}} [options] show-player
  Show all details of a given player
  {dim Options:}
    --username/-u             Desired username
    ${commonOptions}`
}

/**
 * @param {Game} gameA
 * @param {Game} gameB
 * @returns {number}
 */
function byCreatedDate({ created: a }, { created: b }) {
  return b - a
}
