import { createLight } from '../../src/3d'
import { configures3dTestEngine } from '../test-utils'

configures3dTestEngine()

describe('createLight()', () => {
  it('creates default lights and shadow generator', () => {
    const { light, shadowGenerator } = createLight()
    expect(light.name).toEqual('sun')
    expect(light.intensity).toEqual(0.8)
    expect(light.specular.asArray()).toEqual([0, 0, 0])
    expect(light.direction.x).toEqual(0)
    expect(light.direction.y).toEqual(-10)
    expect(light.direction.z).toEqual(0)

    expect(shadowGenerator.mapSize).toEqual(1024)
    expect(shadowGenerator.getLight()).toEqual(light)
  })
})
