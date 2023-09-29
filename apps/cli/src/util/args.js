// @ts-check
import arg from 'arg'
import camelCase from 'lodash.camelcase'

const requiredSymbol = Symbol('required')

export const RequiredString = (/** @type {any} */ value) => String(value)
RequiredString.required = requiredSymbol

/**
 * Parse provided command line arguments against spec.
 * @template {arg.Spec} T
 * @param {string[]} argv - array of parsed arguments (without executable and current file).
 * @param {T} spec - parser specification.
 * @returns parsed command line arguments.
 */
export function parseArgv(argv = [], spec) {
  const parsed = arg(spec, { permissive: true, argv })
  const args = Object.fromEntries(
    Object.entries(parsed).map(([name, value]) => [
      name === '_' ? 'command' : camelCase(name),
      value
    ])
  )
  if (!args.help) {
    for (const name in spec) {
      const friendlyName = camelCase(name)
      // @ts-expect-error:  Property 'required' does not exist on type 'string'
      if (spec[name].required && !(friendlyName in args)) {
        throw new Error(`no ${friendlyName} provided`)
      }
    }
  }
  return args
}

/**
 * Removes the first command from parsed arguments.
 * @param {string[]} argv - array of parsed arguments.
 * @param {string} command - removed command
 * @returns the parsed arguments without stripped command.
 */
export function shiftCommand(argv, command) {
  return argv.filter(arg => camelCase(arg) !== command)
}

/**
 * Spec for common arguments.
 * @typedef {object}
 */
export const commonArgSpec = {
  '--help': Boolean,
  '--production': Boolean,
  '-h': '--help',
  '-p': '--production'
}
