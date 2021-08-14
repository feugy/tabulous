/**
 * Turn an angle from radian to degree
 * @param {number} radian - angle in radian
 * @return {number} same angle in degree
 */
export function toDeg(radian) {
  return radian * (180 / Math.PI)
}

/**
 * Normalize a value from a input range [-maxInput..maxInput] within an output range [min..max]
 * @param {number} value - normalized value
 * @param {number} maxInput - maximum input value (used for both negative and positive)
 * @param {number} min - minimum output value, positive
 * @param {number} max - maximum output value, positive
 * @returns {number} the normalized value within [min..max]
 */
export function normalize(value, maxInput, min, max) {
  // normalize within [0..1], then apply to [min..max]
  const result =
    min + (Math.min(Math.abs(value), maxInput) / maxInput) * (max - min)
  return value < 0 ? -result : result
}

/**
 * Computes Euclidean distance between two (screen coordinates) points.
 * @param {import('../3d/utils').ScreenPosition} first - first screen position.
 * @param {import('../3d/utils').ScreenPosition} second - second screen position.
 */
export function distance(first, second) {
  return Math.sqrt(
    Math.pow(first.x - second.x, 2) + Math.pow(first.y - second.y, 2)
  )
}
