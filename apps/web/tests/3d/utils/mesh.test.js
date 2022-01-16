import { Scene } from '@babylonjs/core/scene'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import {
  adaptTexture,
  attachMaterialError,
  getHeight,
  isContaining
} from '../../../src/3d/utils'

let engine

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementationOnce(() => {})
  engine = new NullEngine()
  new Scene(engine)
})

afterAll(() => engine.dispose())

describe('getHeight() 3D utility', () => {
  it('returns the height of a box', () => {
    const height = 3
    const box = CreateBox('box', { width: 2, height, depth: 4 })
    expect(getHeight(box)).toEqual(height / 2)
  })

  it('returns the height of a positionned box', () => {
    const height = 6
    const box = CreateBox('box', { width: 2, height, depth: 4 })
    box.setAbsolutePosition(new Vector3(-3, -5, -6))
    expect(getHeight(box)).toEqual(height / 2)
  })

  it('returns the height of a rotated box', () => {
    const height = 6
    const box = CreateBox('box', { width: 2, height, depth: 4 })
    box.rotation.x = Math.PI / 4
    box.setAbsolutePosition(new Vector3(2, 4, 6))
    box.computeWorldMatrix()
    expect(getHeight(box)).toBeGreaterThan(height / 2)
  })
})

describe('isContaining() 3D utility', () => {
  let bigBox
  let smallBox

  beforeAll(() => {
    bigBox = CreateBox('Md', { width: 10, height: 10, depth: 10 })
    smallBox = CreateBox('Sm', { width: 3, height: 3, depth: 3 })
  })

  beforeEach(() => {
    bigBox.setAbsolutePosition(Vector3.Zero())
    bigBox.computeWorldMatrix()
    smallBox.setAbsolutePosition(Vector3.Zero())
    smallBox.computeWorldMatrix()
  })

  it('returns true when testing whether the big box is containing the small one', () => {
    expect(isContaining(bigBox, smallBox)).toBe(true)
  })

  it('returns false when testing whether the small box is containing the big one', () => {
    expect(isContaining(smallBox, bigBox)).toBe(false)
  })

  it('returns false when testing boxes that do not interesects', () => {
    smallBox.setAbsolutePosition(new Vector3(0, 20, 0))
    smallBox.computeWorldMatrix()
    expect(isContaining(bigBox, smallBox)).toBe(false)
  })

  it('returns false when testing boxes that interesects', () => {
    smallBox.setAbsolutePosition(new Vector3(0, 4, 0))
    smallBox.computeWorldMatrix()
    expect(isContaining(bigBox, smallBox)).toBe(false)
  })
})

describe('adaptTexture() 3D utility', () => {
  const ktx2 = 'some/path/to/texture.ktx2'
  const png = 'some/path/to/texture.gl1.png'

  describe('given an WebGL 1 engine', () => {
    it.each([
      ['downgrades KTX2 to PNG', ktx2, png],
      ['keeps PNG as PNG', png, png],
      ['handles null', null, null],
      ['handles undefined', undefined, undefined]
    ])('%s', (text, original, result) => {
      expect(adaptTexture(original)).toEqual(result)
    })
  })

  describe('given an WebGL 2 engine', () => {
    let version

    beforeEach(() => {
      version = engine._webGLVersion
      engine._webGLVersion = 2.0
    })

    afterEach(() => (engine._webGLVersion = version))

    it.each([
      ['keeps KTX2 as KTX2', ktx2, ktx2],
      ['keeps PNG as PNG', png, png],
      ['handles null', null, null],
      ['handles undefined', undefined, undefined]
    ])('%s', (text, original, result) => {
      expect(adaptTexture(original)).toEqual(result)
    })
  })
})

describe('attachMaterialError() 3D utility', () => {
  let material
  let shadowGenerator

  beforeEach(() => {
    shadowGenerator = {}
    material = {
      getScene: () => ({
        lights: [
          { getShadowGenerator: jest.fn().mockReturnValue(shadowGenerator) }
        ]
      })
    }
  })

  it('disables shadow generator on material shader error', () => {
    attachMaterialError(material)
    expect(material.onError).toBeInstanceOf(Function)
    expect(shadowGenerator).toEqual({})
    material.onError(null, ['FRAGMENT SHADER'])
    expect(shadowGenerator).toEqual({
      usePercentageCloserFiltering: false,
      useContactHardeningShadow: false
    })
  })

  it('ignores all other errors', () => {
    attachMaterialError(material)
    expect(material.onError).toBeInstanceOf(Function)
    expect(shadowGenerator).toEqual({})
    material.onError(null, ['OTHER', 'ERROR'])
    expect(shadowGenerator).toEqual({})
    material.onError()
    expect(shadowGenerator).toEqual({})
  })
})
