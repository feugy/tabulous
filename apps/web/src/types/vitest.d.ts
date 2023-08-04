/* eslint-disable no-unused-vars */
import type { Assertion, AsymmetricMatchersContaining } from 'vitest'

interface CustomMatchers<R = unknown> {
  toEqualWithAngle<E extends { angle: number }>(expected: E): R
}

declare module 'vitest' {
  interface Assertion<T = ?> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
