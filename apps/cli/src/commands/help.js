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
    list-players                List all existing player accounts
    add-player                  Creates a new player account
    show-player                 Show details for a given player
    catalog                     Lists accessible games
    configure-loggers [levels]  Changes loggers levels
    grant [game-name]           Grants access to a copyrighted game
    revoke [game-name]          Revokes access to a copyrighted game
    delete-game [game-id]       Deletes an existing game or lobby
    delete-player [player-id]   Deletes an existing player account
  {dim Common options:}
    ${commonOptions}`
}

export const commonOptions = `--production/-p           Loads configuration from .env.prod
    --help/-h                 Displays help for this command`
