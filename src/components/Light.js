import { DirectionalLight } from 'three'

export default function create() {
  const instance = new DirectionalLight('white', 3)
  instance.position.set(0, 0, 10)
  instance.castShadow = true

  return {
    instance,
    dispose() {}
  }
}
