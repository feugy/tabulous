// @ts-check
/**
 * Awaits for some time.
 * @param {number} [n=0] - number of milliseconds to wait for
 * @returns {Promise<void>}
 */
export async function sleep(n = 0) {
  await new Promise(resolve => setTimeout(resolve, n))
}
