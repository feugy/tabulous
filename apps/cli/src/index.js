#!/usr/bin/env -S node --no-warnings
// @ts-check

import chalkTemplate from 'chalk-template'
import { config } from 'dotenv'
import esMain from 'es-main'
import camelCase from 'lodash.camelcase'
import { resolve } from 'path'
import { cwd } from 'process'

import * as commands from './commands/index.js'
import { commonArgSpec, parseArgv, shiftCommand } from './util/args.js'
import { printWithFormaters } from './util/formaters.js'

/**
 * @typedef {object} Arguments
 * @property {string[]} command - list of entered commands.
 * @property {boolean} [production] - whether to use production or local instance.
 */

/**
 * @typedef {object} _Command - a given command function
 * @property {() => string} [help] - returns the help message for this command.
 */
/** @typedef {_Command & ((argv: string[]) => string | Promise<?|string>)}  Command*/

/**
 * Parses provided command line arguments and run the corresponding command.
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 */
export default async function main(argv) {
  const args = parseArgv(argv, commonArgSpec)
  loadEnv(args)
  printProductionMessage(args)

  const [name, command] = findCommand(args)
  if (name && command) {
    await invokeCommand(command, argv, name)
  } else {
    printErrorAndHelp(new Error(`unknown command "${argv.join(' ')}"`))
  }
  console.log('')
}

/**
 * @param {Arguments} args
 */
function loadEnv({ production }) {
  config({ path: resolve(cwd(), production ? '.env.prod' : '.env') })
}

/**
 * @param {Arguments} args
 */
function printProductionMessage({ production }) {
  if (production) {
    console.log(chalkTemplate`🚀 using {underline production}\n`)
  }
}

/**
 * @param {Arguments} args
 * @return {[] | [string, Command]} the corresponding command and its name.
 */
function findCommand(args) {
  const command = args.command.map(arg => camelCase(arg))
  return Object.entries(commands).find(([name]) => command.includes(name)) ?? []
}

/**
 * @param {Command} command - the executed command.
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @param {string} name - executed command name.
 */
async function invokeCommand(command, argv, name) {
  try {
    const results = await command(shiftCommand(argv, name))
    printWithFormaters(results)
  } catch (err) {
    printErrorAndHelp(/** @type {Error} */ (err), command)
  }
}

/**
 * @param {Error} err - caught error.
 * @param {Command | { help: () => string }} [command = commands] - executed function, if any.
 */
function printErrorAndHelp(err, command = commands) {
  console.log(chalkTemplate`{bold {redBright error}}: ${err.message}`)
  console.log(command.help?.())
}

/* c8 ignore next 3 */
if (esMain(import.meta)) {
  main(process.argv.slice(2))
}
