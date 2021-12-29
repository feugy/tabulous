import { Axis, Space } from '@babylonjs/core/Maths/math.axis'
import { DiscBuilder } from '@babylonjs/core/Meshes/Builders/discBuilder'

/**
 * Creates an pointer representing a peer player.
 * For now, a simple disc, that casts shadows.
 * @param {object} params - point parameters, including:
 * @param {string} params.id - the peer id.
 * @returns {import('@babylonjs/core').Mesh} the created peer pointer.
 */
export function createPeerPointer({ id }) {
  const peerPointer = DiscBuilder.CreateDisc('peer-pointer', { radius: 0.2 })
  peerPointer.id = id
  peerPointer.isPickable = false
  peerPointer.rotate(Axis.X, Math.PI / 2, Space.LOCAL)
  return peerPointer
}
