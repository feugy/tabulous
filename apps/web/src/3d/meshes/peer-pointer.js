import { Axis, Space } from '@babylonjs/core/Maths/math.axis'
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder'

/**
 * Creates an pointer representing a peer player.
 * For now, a simple disc, that casts shadows.
 * @param {object} params - point parameters, including:
 * @param {string} params.id - the peer id.
 * @param {import('@babylonjs/core').Scene} scene? - scene to host the peer pointer (default to last scene).
 * @returns {import('@babylonjs/core').Mesh} the created peer pointer.
 */
export function createPeerPointer({ id }, scene) {
  const mesh = CreateDisc(id, { radius: 0.2 }, scene)
  mesh.name = 'peer-pointer'
  mesh.isPickable = false
  mesh.rotate(Axis.X, Math.PI / 2, Space.LOCAL)
  return mesh
}
