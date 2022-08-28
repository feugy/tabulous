/**
 * Turns a sentence in uppercase and only keeps its initials.
 * @param {string} value - abbreviated value.
 * @returns {string} value's initials.
 */
export function abbreviate(value = '') {
  const words = value.toUpperCase().split(/\s|-|_/)
  return words.map(([letter]) => letter).join('')
}
