// @ts-check
import chalkTemplate from 'chalk-template'
import {
  attachFormater,
  cliName,
  commonArgSpec,
  findUser,
  parseArgv,
  RequiredString
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
  return attachFormater(await findUser(username), formatPlayerDetails)
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
