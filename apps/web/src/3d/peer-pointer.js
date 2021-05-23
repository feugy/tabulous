import { Axis, MeshBuilder, Space } from '@babylonjs/core'

/**
 * Creates an pointer representing a peer player.
 * For now, a simple disc, that casts shadows.
 * @param {object} params - point parameters, including:
 * @param {string} params.id - the peer id.
 * @returns the created peer.
 */
export function createPeerPointer({ id } = {}) {
  const peerPointer = MeshBuilder.CreateDisc('peer-pointer', { radius: 0.2 })
  peerPointer.id = id
  peerPointer.isPickable = false
  peerPointer.rotate(Axis.X, Math.PI / 2, Space.LOCAL)
  return peerPointer
}
