// @ts-check
import { gql } from '@urql/core'
import chalkTemplate from 'chalk-template'

import {
  attachFormater,
  cliName,
  commonArgSpec,
  getGraphQLClient,
  parseArgv,
  signToken
} from '../util/index.js'
import { commonOptions } from './help.js'

const configureLoggersMutation = gql`
  mutation configureLoggerLevels($levels: [InputLoggerLevel!]!) {
    configureLoggerLevels(levels: $levels) {
      name
      level
    }
  }
`
/**
 * Triggers logger configuration command
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @returns the configured loggers (or help message).
 */
export default async function configureLoggerCommand(argv) {
  const args = parseArgv(argv, {
    ...commonArgSpec
  })
  if (args.help) {
    return configureLoggerCommand.help()
  }
  /** @type {string|undefined} */
  const levels = args.command?.[0]
  if (!levels) {
    throw new Error('no levels provided')
  }
  return configureLevels({ levels: parseLevels(levels) })
}

/**
 * @param {string} input - input string containing levels.
 * @returns parsed logger levels.
 * @throws {Error} when the input string is not compliant.
 */
function parseLevels(input) {
  return input.split(',').map(nameAndLevel => {
    const [name, level] = nameAndLevel.split(':').map(n => n.trim())
    if (!name || !level) {
      throw new Error(`misformated levels: "${input}"`)
    }
    return { name, level }
  })
}

/**
 * @typedef {object} AddPlayerArgs
 * @property {string} username - created player's name.
 * @property {string} password - initial password clear value.
 */

/**
 * Configures logger levels.
 * @param {{ levels: { name: string, level: string}[] }} args - configuration arguments.
 * @returns the configured loggers.
 */
export async function configureLevels({ levels }) {
  const { configureLoggerLevels: results } = await getGraphQLClient().mutation(
    configureLoggersMutation,
    { levels },
    signToken()
  )
  return attachFormater(results, formatLogger)
}

function formatLogger(/** @type {{ name: string, level: string }[]} */ levels) {
  return levels.map(({ name, level }) => `- ${name}: ${level}`).join('\n')
}

configureLoggerCommand.help = function help() {
  return chalkTemplate`
  {bold ${cliName}} [options] configure-loggers [levels]
  Configures loggers levels (a comma-separated list of logger:level strings)
  {dim Options:}
    ${commonOptions}`
}
