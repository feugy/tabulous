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
 * Parses provided command line arguments and run the corresponding command.
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 */
export default async function main(argv) {
  const args = parseArgv(argv, commonArgSpec)
  loadEnv(args)
  printProductionMessage(args)

  const [name, command] = findCommand(args)
  if (!command) {
    printErrorAndHelp(new Error(`unknown command "${argv.join(' ')}"`))
  } else {
    await invokeCommand(command, argv, name)
  }
  console.log('')
}

function loadEnv({ production }) {
  config({ path: resolve(cwd(), production ? '.env.prod' : '.env') })
}

function printProductionMessage({ production }) {
  if (production) {
    console.log(chalkTemplate`🚀 using {underline production}\n`)
  }
}

function findCommand(args) {
  const command = args.command.map(arg => camelCase(arg))
  return Object.entries(commands).find(([name]) => command.includes(name)) ?? []
}

async function invokeCommand(command, argv, name) {
  try {
    const results = await command(shiftCommand(argv, name))
    printWithFormaters(results)
  } catch (err) {
    printErrorAndHelp(err, command)
  }
}

function printErrorAndHelp(err, command = commands) {
  console.log(chalkTemplate`{bold {redBright error}}: ${err.message}`)
  console.log(command.help())
}

/* c8 ignore next 3 */
if (esMain(import.meta)) {
  main(process.argv.slice(2))
}
