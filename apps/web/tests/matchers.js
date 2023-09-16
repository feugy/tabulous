// @ts-check
/**
 * @typedef {import('vitest').SpyInstance<?, ?>} SpyInstance
 * @typedef {import('@vitest/expect').MatcherState} MatcherState
 * @typedef {import('@vitest/expect').SyncExpectationResult} SyncExpectationResult
 */

import { isA } from '@vitest/expect'

export function numberCloseTo(
  /** @type {any} */ received,
  /** @type {number} */ expected,
  precision = 10
) {
  const pass =
    isA('Number', received) &&
    expected.toFixed(precision) === received.toFixed(precision)
  return {
    message: () =>
      `expected ${received}${
        pass ? ' not' : ''
      } to be close to ${expected} (${precision} decimals)`,
    pass
  }
}

/**
 * @template {{ angle: number }} E
 * @this {MatcherState}
 * @param {?} actual
 * @param {E} expected
 * @returns {SyncExpectationResult}
 */
export function toEqualWithAngle(actual, expected) {
  const decimals = 10
  const actualHasAngle = typeof actual === 'object' && 'angle' in actual
  const expectedHasAngle = typeof expected === 'object' && 'angle' in expected
  let pass = false
  if (actualHasAngle && expectedHasAngle) {
    const { angle: actualAngle, ...otherActual } = actual
    const { angle: expectedAngle, ...otherExpected } = expected
    pass =
      this.equals(otherActual, otherExpected) &&
      actualAngle.toFixed(decimals) === expectedAngle.toFixed(decimals)
  }
  return {
    message: () => `actual is${this.isNot ? ' not' : ''} equal to expected`,
    pass,
    actual,
    expected
  }
}
