// @ts-check

/**
 * Shuffle an array, several times, using Fisher–Yates algorithm.
 * @template T
 * @param {T[]} source - source array.
 * @param {number} [iterations=5] - how many times the array is shuffled.
 * @returns {T[]} a randomized copy of the source array.
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

/**
 * Pick a random value amongst candidates, ignoring some of the candidates.
 * @template T
 * @param {T[]} candidates - possible candidates.
 * @param {T[]} [ignored=[]] - ignored candidates.
 * @returns {T} one of the candidates
 */
export function pickRandom(candidates = [], ignored = []) {
  const actualCandidates = candidates.filter(
    candidate => !ignored.includes(candidate)
  )
  return actualCandidates[Math.floor(Math.random() * actualCandidates.length)]
}
