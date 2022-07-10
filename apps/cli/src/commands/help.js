// @ts-check
import chalk from 'chalk'
import { cliName } from '../util/index.js'

/**
 * Prints help message on console.
 */
export function help() {
  console.log(`
  ${chalk.bold(`${cliName}`)} [options] <command>
  ${chalk.dim('Commands:')}
    catalog                   List accessible game
    grant [game-name]         Grant access to a copyright game
    revoke [game-name]        Revoke access to a copyright game
  ${chalk.dim('Options:')}
    --help/-h                 Display help for a given command or subcommand
    --username/-u             Username for which command is run
    --production/-p           Load configuration from .env.local
`)
}
