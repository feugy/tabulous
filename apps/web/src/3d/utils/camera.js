/**
 * Returns the engine active camera.
 * @param {import('@babylonjs/core').Engine} engine - 3D engine.
 * @returns {import('@babylonjs/core').Camera} the active camera, or null.
 */
export function getCamera(engine) {
  return engine?.scenes?.[0]?.activeCamera ?? null
}
