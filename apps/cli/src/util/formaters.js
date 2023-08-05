// @ts-check
/**
 * @typedef {import('@tabulous/server/src/graphql').Game} Game
 * @typedef {import('@tabulous/server/src/graphql').Player} Player
 */

import chalkTemplate from 'chalk-template'

const symbol = Symbol('formaters')

/**
 * Prints on console the provided object with its attached formaters.
 * If there are none, prints it raw.
 * @param {object} object - printed object
 */
export function printWithFormaters(object) {
  for (const output of applyFormaters(object)) {
    console.log(output)
  }
}

/**
 * Invokes formaters of an object.
 * @template {Record<string|symbol, any>} T
 * @param {T} object - printed object.
 * @returns {(T|string)[]} list of outputs, either strings or raw objects.
 */
export function applyFormaters(object) {
  /** @type {(T|string)[]} */
  const output = ['']
  const formaters = object?.[symbol] ?? []
  for (const formater of formaters) {
    output.push(formater(object))
  }
  if (formaters.length === 0) {
    output.push(object)
  }
  return output
}

/**
 * Adds a formater to an object. The new formater can be added at the beginning of the formater list, or at the end (default)
 * @template {Record<string|symbol, any>} T
 * @param {T} object - object to add this formater to.
 * @param {(obj: T) => string} formater - added formater function.
 * @param {boolean} [first=false] - whether to add this formater first or last.
 * @returns {T} the mutated object.
 */
export function attachFormater(object, formater, first = false) {
  let formaters = object[symbol]
  if (!formaters) {
    formaters = []
    // @ts-ignore
    object[symbol] = formaters
  }
  formaters[first ? 'unshift' : 'push'](formater)
  return object
}

/**
 * Formater for game objects.
 * @param {Game} game - game to format.
 * @returns {string} formatted game.
 */
export function formatGame({ id, created, kind }) {
  return chalkTemplate`${kind ? `${kind} game` : `🛋️ lobby`} {dim ${formatDate(
    created
  )}} (${id})`
}

/**
 * Formater for player objects.
 * @param {Player} player - player to format.
 * @return {string} formatted player.
 */
export function formatPlayer({ id, username, email }) {
  return chalkTemplate`{bold ${username}} {dim ${email || 'no email'}} (${id})`
}

const timeAndDate = new Intl.DateTimeFormat('en-gb', {
  timeStyle: 'medium',
  dateStyle: 'short'
})

/**
 * Formater for timestamps.
 * @param {number} timestamp - timestamp to format.
 * @returns {string} localized date and time.
 */
export function formatDate(timestamp) {
  return !timestamp ? 'unknown' : timeAndDate.format(timestamp)
}
