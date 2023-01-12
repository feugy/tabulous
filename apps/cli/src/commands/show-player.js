// @ts-check
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

/**
 * @typedef {object} PlayerDetails
 * @property {string} id
 * @property {string} username
 * @property {number} currentGameId
 * @property {string} provider
 * @property {string} email
 * @property {boolean} termsAccepted
 * @property {import('../util/formaters.js').Game[]} games
 */

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

function formatGames({ id: playerId, games }) {
  const { owned, invited } = games.reduce(
    (counts, game) => {
      if (game.players.find(({ id, isOwner }) => isOwner && id === playerId)) {
        counts.owned.push(game)
      } else {
        counts.invited.push(game)
      }
      return counts
    },
    { owned: [], invited: [] }
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

function byCreatedDate({ created: a }, { created: b }) {
  return b - a
}
