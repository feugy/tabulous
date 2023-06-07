export function toEqualWithAngle(actual, expected) {
  const decimals = 10
  const actualHasAngle = typeof actual === 'object' && 'angle' in actual
  const expectedHasAngle = typeof expected === 'object' && 'angle' in expected
  let pass = false
  if (actualHasAngle && expectedHasAngle) {
    const { angle: actualAngle, ...otherActual } = actual
    const { angle: expectedAngle, ...otherExpected } = expected
    pass =
      this.equals(otherActual, otherExpected, this.customTesters) &&
      actualAngle.toFixed(decimals) === expectedAngle.toFixed(decimals)
  }
  return {
    message: () => `actual is${this.isNot ? ' not' : ''} equal to expected`,
    pass,
    actual,
    expected
  }
}
