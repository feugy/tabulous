/**
 * Awaits for some time.
 * @aync
 * @param {number} [duration=0] - number of milliseconds to wait for
 */
export async function sleep(n = 0) {
  await new Promise(resolve => setTimeout(resolve, n))
}
