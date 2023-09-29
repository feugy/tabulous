// @ts-check

/**
 * Builds a camera save for a given player, with default values:
 * - alpha = PI * 3/2 (south)
 * - beta = PI / 8 (slightly elevated from ground)
 * - elevation = 35
 * - target = [0,0,0] (the origin)
 * - index = 0 (default camera position)
 * It adds the hash.
 * @param {Partial<import('@tabulous/types').CameraPosition>} cameraPosition - a partial camera position without hash.
 * @returns the built camera position.
 */
export function buildCameraPosition({
  playerId,
  index = 0,
  target = [0, 0, 0],
  alpha = (3 * Math.PI) / 2,
  beta = Math.PI / 8,
  elevation = 35
} = {}) {
  if (!playerId) {
    throw new Error('camera position requires playerId')
  }
  return addHash({
    hash: '',
    playerId,
    index,
    target,
    alpha,
    beta,
    elevation
  })
}

/**
 * @param {import('@tabulous/types').CameraPosition} position - camera to extend with hash.
 * @returns the augmented camera.
 */
function addHash(position) {
  position.hash = `${position.target[0]}-${position.target[1]}-${position.target[2]}-${position.alpha}-${position.beta}-${position.elevation}`
  return position
}
