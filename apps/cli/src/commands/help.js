// @ts-check
import chalkTemplate from 'chalk-template'

import { cliName } from '../util/index.js'

/**
 * Returns general help message.
 * @return {string} the general help message
 */
export function help() {
  return chalkTemplate`
  {bold ${cliName}} [options] <command>
  {dim Commands:}
    add-player                Creates a new player account
    catalog                   Lists accessible games
    grant [game-name]         Grants access to a copyrighted game
    revoke [game-name]        Revokes access to a copyrighted game
    show-player               Show details for a given player
  {dim Common options:}
    --username/-u             Username for which command is run
    --production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for a given command
`
}
