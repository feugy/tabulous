// @ts-check

import chalkTemplate from 'chalk-template'

const symbol = Symbol('formaters')

/**
 * Prints on console the provided object with its attached formaters.
 * If there are none, prints it raw.
 * @param {any} object - printed object
 */
export function printWithFormaters(object) {
  for (const output of applyFormaters(object)) {
    console.log(output)
  }
}

/**
 * Invokes formaters of an object.
 * @param {*} object - printed object.
 * @returns {Array<object|string>} list of outputs, either strings or raw objects.
 */
export function applyFormaters(object) {
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
 * @param {any} object - object to add this formater to.
 * @param {function} formater - added formater function.
 * @param {boolean} [first=false] - whether to add this formater first or last.
 * @returns {any} the mutated object.
 */
export function attachFormater(object, formater, first = false) {
  let formaters = object[symbol]
  if (!formaters) {
    formaters = []
    object[symbol] = formaters
  }
  formaters[first ? 'unshift' : 'push'](formater)
  return object
}

/**
 * @typedef {object} Game game details
 * @property {string} id - game unique identifier.
 * @property {string} kind? - game kind, if any.
 * @property {number} created - creation timestamp.
 */

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
 * @typedef {object} Player player account
 * @property {string} id - player unique identifier.
 * @property {string} username - player display name.
 * @property {string} email? - player email, when relevant.
 */

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
