import Babylon from 'babylonjs'

const { Axis, MeshBuilder, Space } = Babylon

export function createPeerPointer({ id } = {}) {
  const peerPointer = MeshBuilder.CreateDisc('peer-pointer', { radius: 0.2 })
  peerPointer.id = id
  peerPointer.isPickable = false
  peerPointer.rotate(Axis.X, Math.PI / 2, Space.LOCAL)
  return peerPointer
}
