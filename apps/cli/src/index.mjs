#!/usr/bin/env -S node --no-warnings
// @ts-check
// this file is using mjs for istanbul to stop complaining about import.meta

import esMain from 'es-main'
import { config } from 'dotenv'
import camelCase from 'lodash.camelcase'
import { resolve } from 'path'
import { cwd } from 'process'
import * as commands from './commands/index.js'
import { commonArgSpec, parseArgv, shiftCommand } from './util/args.js'
import chalkTemplate from 'chalk-template'
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
    await invokeCommand(commands.help, [], '')
  } else {
    await invokeCommand(command, argv, name)
  }
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
    console.log(chalkTemplate`{bold {redBright error}}: ${err.message}`)
    console.log(commands.help())
  }
}

/* istanbul ignore next */
if (esMain(import.meta)) {
  main(process.argv.slice(2))
}
