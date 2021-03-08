import { BoxGeometry, Mesh, MeshPhongMaterial } from 'three'

export default function create({
  x = 0,
  y = 0,
  width = 100,
  height = 50,
  color = '#CCC'
} = {}) {
  const geometry = new BoxGeometry(width, height, 1, 1, 1, 1)
  const material = new MeshPhongMaterial({ color })
  const instance = new Mesh(geometry, material)
  instance.position.set(x, y, -1)

  return {
    instance,
    dispose() {}
  }
}
