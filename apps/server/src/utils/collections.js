/**
 * Shuffle an array, several times, using Fisher–Yates algorithm.
 * @param {any[]} source - source array.
 * @param {number} [iterations=3] - how many times the array is shuffled.
 * @returns {any[]} a randomized copy of the source array.
 * @see {@link https://bost.ocks.org/mike/shuffle/}
 */
export function shuffle(source = [], iterations = 5) {
  const result = Array.isArray(source) ? [...source] : []

  while (iterations-- > 0) {
    let { length } = result
    let i
    while (length) {
      i = Math.floor(Math.random() * length--)
      const value = result[length]
      result[length] = result[i]
      result[i] = value
    }
  }

  return result
}
