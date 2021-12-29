import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { configures3dTestEngine } from '../../test-utils'
import { DetailBehavior, DetailBehaviorName } from '../../../src/3d/behaviors'
import { controlManager } from '../../../src/3d/managers'
import faker from 'faker'

describe('DetailBehavior', () => {
  configures3dTestEngine()

  const onDetailedObserver = jest.fn()

  beforeEach(jest.resetAllMocks)

  beforeAll(() => controlManager.onDetailedObservable.add(onDetailedObserver))

  afterAll(() => controlManager.onDetailedObservable.remove(onDetailedObserver))

  it('has initial state', () => {
    const behavior = new DetailBehavior()
    const mesh = BoxBuilder.CreateBox('box', {})

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(DetailBehaviorName)

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('can not show details without mesh', () => {
    const behavior = new DetailBehavior()
    behavior.detail()
    expect(onDetailedObserver).not.toHaveBeenCalled()
  })

  describe('given attached to a mesh', () => {
    let mesh
    let behavior

    beforeEach(() => {
      behavior = new DetailBehavior()
      mesh = BoxBuilder.CreateBox('box', {})
      mesh.addBehavior(behavior, true)
    })

    it('attaches metadata to its mesh', () => {
      expect(mesh.metadata).toEqual({
        images: {},
        detail: expect.any(Function)
      })
    })

    it('can show details without images', () => {
      mesh.metadata.detail()
      expect(onDetailedObserver).toHaveBeenCalledTimes(1)
      expect(onDetailedObserver).toHaveBeenCalledWith(
        {
          mesh,
          data: { image: null }
        },
        expect.anything()
      )
    })

    describe('given images on mesh', () => {
      const front = faker.internet.url()
      const back = faker.internet.url()

      beforeEach(() => {
        mesh.metadata.images = { front, back }
      })

      it('can show front image', () => {
        mesh.metadata.detail()
        expect(onDetailedObserver).toHaveBeenCalledTimes(1)
        expect(onDetailedObserver).toHaveBeenCalledWith(
          { mesh, data: { image: front } },
          expect.anything()
        )
      })

      it('can show back image', () => {
        mesh.metadata.isFlipped = true
        mesh.metadata.detail()
        expect(onDetailedObserver).toHaveBeenCalledTimes(1)
        expect(onDetailedObserver).toHaveBeenCalledWith(
          { mesh, data: { image: back } },
          expect.anything()
        )
      })
    })
  })
})
