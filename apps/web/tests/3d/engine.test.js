import faker from 'faker'

import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Scene } from '@babylonjs/core/scene'
import { createEngine } from '../../src/3d'

describe('createEngine()', () => {
  it('initializes engine with parameters', () => {
    jest.spyOn(console, 'log').mockImplementationOnce(() => ({}))
    const canvas = document.createElement('canvas')
    const interaction = document.createElement('div')
    const doubleTapDelay = faker.datatype.number()
    const longTapDelay = faker.datatype.number()
    const engine = createEngine({
      Engine: NullEngine,
      canvas,
      interaction,
      doubleTapDelay,
      longTapDelay
    })
    expect(engine.enableOfflineSupport).toBe(false)
    expect(engine.inputElement).toEqual(interaction)
    expect(Scene.DoubleClickDelay).toEqual(doubleTapDelay)

    // TODO input manager stopAll()
  })
})
