import Babylon from 'babylonjs'
const { Color3, MeshBuilder, StandardMaterial } = Babylon

export function createTable({
  width = 100,
  height = 50,
  color = new Color3(0.5, 0.5, 0.5)
} = {}) {
  const table = MeshBuilder.CreateGround('table', { width, height })
  table.position.y = -0.01
  table.receiveShadows = true

  table.material = new StandardMaterial('table-front')
  table.material.emissiveColor = color
  return table
}
