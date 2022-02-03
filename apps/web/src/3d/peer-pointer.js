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
  const peerPointer = CreateDisc('peer-pointer', { radius: 0.2 }, scene)
  peerPointer.id = id
  peerPointer.isPickable = false
  peerPointer.rotate(Axis.X, Math.PI / 2, Space.LOCAL)
  return peerPointer
}
