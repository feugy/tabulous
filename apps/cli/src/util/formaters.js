// @ts-check

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
