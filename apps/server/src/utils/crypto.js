// @ts-check
import { createHash } from 'node:crypto'

/**
 * Hashes the provided value.
 * @param {string} value - the clear string.
 * @returns {string} its hash.
 */
export function hash(value) {
  return createHash('sha512').update(value).digest('hex')
}
