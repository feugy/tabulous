import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import { materialManager as manager } from '@src/3d/managers'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { configures3dTestEngine, createBox } from '../../test-utils'

describe('MaterialManager', () => {
  let scene
  let handScene
  let engine
  const gameAssetsUrl = 'https://localhost:3000'

  configures3dTestEngine(created => ({ scene, handScene, engine } = created))

  it('has initial state', () => {
    expect(manager.scene).toBeNull()
    expect(manager.handScene).toBeNull()
    expect(manager.gameAssetsUrl).toBe('')
  })

  describe('isManaging()', () => {
    it('returns false for unmanaged texture or color', () => {
      expect(manager.isManaging('#0066ff66')).toBe(false)
      expect(manager.isManaging(faker.internet.url())).toBe(false)
    })
  })

  describe('clear()', () => {
    it('does nothing', () => {
      expect(() => manager.clear()).not.toThrow()
    })
  })

  describe('init()', () => {
    it('configures scenes', () => {
      manager.init({ scene, handScene, gameAssetsUrl })
      expect(manager.scene).toEqual(scene)
      expect(manager.handScene).toEqual(handScene)
    })

    it('preloads game materials', () => {
      const texture1 = faker.internet.url()
      const texture2 = faker.internet.url()
      const texture3 = faker.internet.url()
      const color1 = '#0066ff66'
      const color2 = '#ff6600ff'
      manager.init(
        { scene, gameAssetsUrl },
        {
          meshes: [{ texture: texture1 }, { texture: texture2 }],
          hands: [
            { meshes: [{ texture: texture3 }] },
            { meshes: [{ texture: color1 }, { texture: color2 }] }
          ]
        }
      )
      expect(manager.isManaging(color1)).toBe(true)
      expect(manager.isManaging(color2)).toBe(true)
      expect(manager.isManaging(texture1)).toBe(true)
      expect(manager.isManaging(texture2)).toBe(true)
      expect(manager.isManaging(texture3)).toBe(true)
    })
  })

  describe('given an initialized manager with 2 scenes', () => {
    const ktx2 = '/some/path/to/texture.ktx2'
    const webp = '/some/path/to/texture.gl1.webp'

    let box
    let handBox

    beforeAll(() => manager.init({ scene, handScene, gameAssetsUrl }))

    beforeEach(() => {
      manager.clear()
      box = createBox('box', {}, scene)
      handBox = createBox('hand-box', {}, handScene)
    })

    describe('isManaging()', () => {
      it('returns false for unmanaged texture or color', () => {
        expect(manager.isManaging('#0066ff66')).toBe(false)
        expect(manager.isManaging(faker.internet.url())).toBe(false)
      })

      it('returns true for managed color', () => {
        const color1 = '#0066ff66'
        const color2 = '#ff6600ff'
        manager.configure(box, color1)
        expect(manager.isManaging(color1)).toBe(true)
        expect(manager.isManaging(color2)).toBe(false)
        manager.configure(handBox, color2)
        expect(manager.isManaging(color1)).toBe(true)
        expect(manager.isManaging(color2)).toBe(true)
      })

      it('returns true for managed texture', () => {
        const texture1 = faker.internet.url()
        const texture2 = faker.internet.url()
        manager.configure(box, texture1)
        expect(manager.isManaging(texture1)).toBe(true)
        expect(manager.isManaging(texture2)).toBe(false)
        manager.configure(handBox, texture2)
        expect(manager.isManaging(texture1)).toBe(true)
        expect(manager.isManaging(texture2)).toBe(true)
      })
    })

    describe('clear()', () => {
      it('disposes textures and materials', () => {
        const disposeBoxMaterial = vi.fn()
        const disposeBoxTexture = vi.fn()
        const disposeHandBoxMaterial = vi.fn()
        const texture = faker.internet.url()
        const color = '#ff6600ff'
        manager.configure(box, texture)
        expect(manager.isManaging(texture)).toBe(true)
        manager.configure(handBox, color)
        expect(manager.isManaging(color)).toBe(true)
        box.material.onDisposeObservable.addOnce(disposeBoxMaterial)
        box.material.diffuseTexture.onDisposeObservable.addOnce(
          disposeBoxTexture
        )
        handBox.material.onDisposeObservable.addOnce(disposeHandBoxMaterial)

        manager.clear()
        expect(manager.isManaging(texture)).toBe(false)
        expect(manager.isManaging(color)).toBe(false)
        expect(disposeBoxMaterial).toHaveBeenCalledTimes(1)
        expect(disposeBoxTexture).toHaveBeenCalledTimes(1)
        expect(disposeHandBoxMaterial).toHaveBeenCalledTimes(1)
      })
    })

    describe('configure()', () => {
      it('creates a material with a color', () => {
        manager.configure(box, '#0066ff66')
        expect(box.material).toBeInstanceOf(StandardMaterial)
        expect(box.material.diffuseColor?.asArray()).toEqual([0, 0.4, 1, 0.4])
        expect(box.material.alpha).toEqual(0.4)
        expect(box.material.diffuseTexture).toBeNull()
      })

      it('creates a material with a texture', () => {
        const texture = faker.internet.url()
        manager.configure(box, texture)
        expect(box.material).toBeInstanceOf(StandardMaterial)
        expect(box.material.diffuseTexture).toBeInstanceOf(Texture)
      })

      it('reuses existing color material on the same scene', () => {
        const color = '#0066ff66'
        manager.configure(box, color)
        expect(box.material).toBeInstanceOf(StandardMaterial)
        expect(box.material.diffuseColor?.asArray()).toEqual([0, 0.4, 1, 0.4])
        expect(box.material.diffuseTexture).toBeNull()

        const box2 = createBox('box2', {}, box.getScene())
        manager.configure(box2, color)
        expect(box2.material).toBeInstanceOf(StandardMaterial)
        expect(box2.material === box.material).toBe(true)

        manager.configure(handBox, color)
        expect(handBox.material).toBeInstanceOf(StandardMaterial)
        expect(handBox.material === box.material).toBe(false)
      })

      it('reuses existing texture material on the same scene', () => {
        const texture = faker.internet.url()
        manager.configure(box, texture)
        expect(box.material).toBeInstanceOf(StandardMaterial)
        expect(box.material.diffuseTexture).toBeInstanceOf(Texture)

        const box2 = createBox('box2', {}, box.getScene())
        manager.configure(box2, texture)
        expect(box2.material).toBeInstanceOf(StandardMaterial)
        expect(box2.material === box.material).toBe(true)

        manager.configure(handBox, texture)
        expect(handBox.material).toBeInstanceOf(StandardMaterial)
        expect(handBox.material === box.material).toBe(false)
        expect(handBox.material.diffuseTexture.url).toEqual(
          box.material.diffuseTexture.url
        )
      })

      it.each([
        {
          text: 'downgrades KTX2 texture to WebP',
          original: ktx2,
          result: `${gameAssetsUrl}${webp}`
        },
        {
          text: 'keeps WebP texture as WebP',
          original: webp,
          result: `${gameAssetsUrl}${webp}`
        },
        { text: 'handles null texture', result: null },
        {
          text: 'handles undefined texture',
          result: undefined
        }
      ])('$text', ({ original, result }) => {
        manager.configure(box, original ?? result)
        expect(box.material.diffuseTexture.url).toEqual(result)
      })

      describe('given an WebGL 2 engine', () => {
        let version

        beforeEach(() => {
          version = engine._webGLVersion
          engine._webGLVersion = 2.0
        })

        afterEach(() => {
          engine._webGLVersion = version
        })

        it.each([
          {
            text: 'keeps KTX2 texture to WebP',
            original: ktx2,
            result: `${gameAssetsUrl}${ktx2}`
          },
          {
            text: 'keeps WebP texture as WebP',
            original: webp,
            result: `${gameAssetsUrl}${webp}`
          },
          { text: 'handles null texture', result: null },
          { text: 'handles undefined texture', result: undefined }
        ])('$text', ({ original, result }) => {
          manager.configure(box, original ?? result)
          expect(box.material.diffuseTexture.url).toEqual(result)
        })
      })

      describe('given a texture material', () => {
        let material
        let shadowGenerator

        beforeAll(() => {
          const light = new DirectionalLight('sun', Vector3.Down(), scene)
          shadowGenerator = new ShadowGenerator(1024, light)
        })

        beforeEach(() => {
          shadowGenerator._filter = ShadowGenerator.FILTER_PCF
          expect(shadowGenerator.usePercentageCloserFiltering).toBe(true)
          manager.configure(box, ktx2)
          material = box.material
        })

        it('disables shadow generator on material shader error', () => {
          expect(material.onError).toBeInstanceOf(Function)
          material.onError(null, ['FRAGMENT SHADER'])
          expect(shadowGenerator.usePercentageCloserFiltering).toBe(false)
          expect(shadowGenerator.useContactHardeningShadow).toBe(false)
        })

        it('ignores all other errors', () => {
          expect(material.onError).toBeInstanceOf(Function)
          material.onError(null, ['OTHER', 'ERROR'])
          expect(shadowGenerator.usePercentageCloserFiltering).toBe(true)
          expect(shadowGenerator.useContactHardeningShadow).toBe(false)
        })
      })
    })

    describe('buildOnDemand()', () => {
      it('creates a material with a color', () => {
        const texture = `${faker.internet.color()}ff`.toUpperCase()
        expect(manager.isManaging(texture)).toBe(false)
        const material = manager.buildOnDemand(texture, scene)
        expect(material).toBeInstanceOf(StandardMaterial)
        expect(material.diffuseColor?.toHexString()).toEqual(texture)
        expect(material.diffuseTexture).toBeNull()
        expect(manager.isManaging(texture)).toBe(true)
      })

      it('creates a material with a texture', () => {
        const texture = faker.internet.url()
        expect(manager.isManaging(texture)).toBe(false)
        const material = manager.buildOnDemand(texture, scene)
        expect(material).toBeInstanceOf(StandardMaterial)
        expect(material.diffuseTexture).toBeInstanceOf(Texture)
        expect(manager.isManaging(texture)).toBe(true)
      })

      it('reuses existing color material on the same scene', () => {
        const texture = `${faker.internet.color()}ff`.toUpperCase()
        expect(manager.isManaging(texture)).toBe(false)
        const material = manager.buildOnDemand(texture, scene)
        expect(material).toBeInstanceOf(StandardMaterial)

        expect(manager.isManaging(texture)).toBe(true)
        expect(manager.buildOnDemand(texture, scene)).toBe(material)
      })

      it('reuses existing texture material on the same scene', () => {
        const texture = faker.internet.url()
        expect(manager.isManaging(texture)).toBe(false)
        const material = manager.buildOnDemand(texture, scene)
        expect(material).toBeInstanceOf(StandardMaterial)

        expect(manager.isManaging(texture)).toBe(true)
        expect(manager.buildOnDemand(texture, scene)).toBe(material)
      })
    })
  })

  describe('given an initialized manager with no hand scene', () => {
    let box

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      manager.clear()
      box = createBox('box', {}, scene)
    })

    describe('isManaging()', () => {
      it('returns false for unmanaged texture or color', () => {
        expect(manager.isManaging('#0066ff66')).toBe(false)
        expect(manager.isManaging(faker.internet.url())).toBe(false)
      })

      it('returns true for managed color', () => {
        const color = '#0066ff66'
        manager.configure(box, color)
        expect(manager.isManaging(color)).toBe(true)
      })

      it('returns true for managed texture', () => {
        const texture = faker.internet.url()
        manager.configure(box, texture)
        expect(manager.isManaging(texture)).toBe(true)
      })
    })

    describe('clear()', () => {
      it('disposes textures and materials', () => {
        const disposeBoxMaterial = vi.fn()
        const disposeBoxTexture = vi.fn()
        const texture = faker.internet.url()
        const color = '#ff6600ff'
        manager.configure(box, texture)
        expect(manager.isManaging(texture)).toBe(true)
        box.material.onDisposeObservable.addOnce(disposeBoxMaterial)
        box.material.diffuseTexture.onDisposeObservable.addOnce(
          disposeBoxTexture
        )

        manager.clear()
        expect(manager.isManaging(texture)).toBe(false)
        expect(manager.isManaging(color)).toBe(false)
        expect(disposeBoxMaterial).toHaveBeenCalledTimes(1)
        expect(disposeBoxTexture).toHaveBeenCalledTimes(1)
      })
    })

    describe('configure()', () => {
      it('creates a material with a color', () => {
        manager.configure(box, '#0066ff66')
        expect(box.material).toBeInstanceOf(StandardMaterial)
        expect(box.material.diffuseColor?.asArray()).toEqual([0, 0.4, 1, 0.4])
        expect(box.material.alpha).toEqual(0.4)
        expect(box.material.diffuseTexture).toBeNull()
      })

      it('creates a material with a texture', () => {
        const texture = faker.internet.url()
        manager.configure(box, texture)
        expect(box.material).toBeInstanceOf(StandardMaterial)
        expect(box.material.diffuseTexture).toBeInstanceOf(Texture)
      })

      it('reuses existing color material', () => {
        const color = '#0066ff66'
        manager.configure(box, color)
        expect(box.material).toBeInstanceOf(StandardMaterial)
        expect(box.material.diffuseColor?.asArray()).toEqual([0, 0.4, 1, 0.4])
        expect(box.material.diffuseTexture).toBeNull()

        const box2 = createBox('box2', {}, box.getScene())
        manager.configure(box2, color)
        expect(box2.material).toBeInstanceOf(StandardMaterial)
        expect(box2.material === box.material).toBe(true)
      })

      it('reuses existing texture material', () => {
        const texture = faker.internet.url()
        manager.configure(box, texture)
        expect(box.material).toBeInstanceOf(StandardMaterial)
        expect(box.material.diffuseTexture).toBeInstanceOf(Texture)

        const box2 = createBox('box2', {}, box.getScene())
        manager.configure(box2, texture)
        expect(box2.material).toBeInstanceOf(StandardMaterial)
        expect(box2.material === box.material).toBe(true)
      })
    })
  })
})
