import { createLights } from '../../../src/3d/utils'
import { configures3dTestEngine } from '../../test-utils'

let scene
let handScene

configures3dTestEngine(created => {
  scene = created.scene
  handScene = created.handScene
})

describe('createLights() 3D utility', () => {
  it('creates default lights and shadow generator', () => {
    const { light, shadowGenerator } = createLights({ scene, handScene })
    expect(light.name).toEqual('sun')
    expect(light.intensity).toEqual(0.95)
    expect(light.specular.asArray()).toEqual([0, 0, 0])
    expect(light.direction.x).toEqual(0)
    expect(light.direction.y).toEqual(-1)
    expect(light.direction.z).toEqual(0)

    expect(shadowGenerator.mapSize).toEqual(1024)
    expect(shadowGenerator.getLight()).toEqual(light)
  })
})
