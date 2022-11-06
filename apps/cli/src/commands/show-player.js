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

/**
 * @typedef {object} PlayerDetails
 * @property {string} id
 * @property {string} username
 * @property {boolean} playing
 * @property {string} provider
 * @property {string} email
 * @property {boolean} termsAccepted
 */

const listGamesQuery = gql`
  query listGamesQuery {
    listGames {
      id
      kind
      players {
        id
      }
    }
  }
`

/**
 * Triggers show player command.
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns {Promise<PlayerDetails | string>} whether the operation succeeded.
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
 * @returns {Promise<PlayerDetails>} found player details.
 */
export async function showPlayer({ username }) {
  const player = attachFormater(await findUser(username), formatPlayerDetails)
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

function formatPlayerDetails({
  id,
  isAdmin,
  username,
  email,
  provider,
  playing,
  termsAccepted
}) {
  return chalkTemplate`{dim id:}             ${id} ${isAdmin ? '🥷' : ''}
{dim username:}       ${username}
{dim email:}          ${email || 'none'}
{dim provider:}       ${provider || 'manual'}
{dim terms accepted:} ${!!termsAccepted}
{dim is playing:}     ${!!playing}`
}

function formatGames({ id, games }) {
  const { owned, invited } = games.reduce(
    (counts, { players: [owner] }) => {
      if (owner?.id === id) {
        counts.owned++
      } else {
        counts.invited++
      }
      return counts
    },
    { owned: 0, invited: 0 }
  )
  return chalkTemplate`
{dim total games:}    ${games.length}
{dim owned games:}    ${owned}
{dim invited games:}  ${invited}`
}

showPlayerCommand.help = function help() {
  return chalkTemplate`
  {bold ${cliName}} [options] show-player
  Show all details of a given player
  {dim Options:}
    --username/-u             Desired username
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Display help for this command
`
}
