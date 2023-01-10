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
    show-player               Show details for a given player
    catalog                   Lists accessible games
    grant [game-name]         Grants access to a copyrighted game
    revoke [game-name]        Revokes access to a copyrighted game
    delete-game [game-id]     Deletes an existing game or lobby
  {dim Common options:}
    ${commonOptions}`
}

export const commonOptions = `--production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`
