import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { faker } from '@faker-js/faker'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { DetailBehavior, DetailBehaviorName } from '../../../src/3d/behaviors'
import { controlManager } from '../../../src/3d/managers'
import { configures3dTestEngine } from '../../test-utils'

describe('DetailBehavior', () => {
  configures3dTestEngine()

  const onDetailedObserver = vi.fn()

  beforeEach(vi.resetAllMocks)

  beforeAll(() => {
    controlManager.onDetailedObservable.add(onDetailedObserver)
  })

  afterAll(() => controlManager.onDetailedObservable.remove(onDetailedObserver))

  it('has initial state', () => {
    const state = {
      frontImage: faker.image.imageUrl(),
      backImage: faker.image.imageUrl()
    }
    const behavior = new DetailBehavior(state)
    const mesh = CreateBox('box', {})

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(DetailBehaviorName)
    expect(behavior.state).toEqual(state)

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('can not restore state without mesh', () => {
    expect(() => new DetailBehavior().fromState({ front: null })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can not show details without mesh', () => {
    const behavior = new DetailBehavior()
    behavior.detail()
    expect(onDetailedObserver).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const behavior = new DetailBehavior()
    const mesh = CreateBox('box', {})
    mesh.addBehavior(behavior, true)

    behavior.fromState()
    expect(behavior.state).toEqual({ frontImage: null, backImage: null })
    expect(behavior.mesh).toEqual(mesh)
    expect(mesh.metadata.frontImage).toBe(null)
    expect(mesh.metadata.backImage).toBe(null)
  })

  describe.each([
    {
      title: ' with images',
      frontImage: faker.image.imageUrl(),
      backImage: faker.image.imageUrl()
    },
    {
      title: ' with no images',
      frontImage: null,
      backImage: null
    }
  ])('given attached to a mesh$title', ({ frontImage, backImage }) => {
    let mesh
    let behavior

    beforeEach(() => {
      behavior = new DetailBehavior({ frontImage, backImage })
      mesh = CreateBox('box', {})
      mesh.addBehavior(behavior, true)
    })

    it('attaches metadata to its mesh', () => {
      expect(mesh.metadata).toEqual({
        frontImage,
        backImage,
        detail: expect.any(Function)
      })
    })

    it('can show front image', () => {
      mesh.metadata.detail()
      expect(onDetailedObserver).toHaveBeenCalledTimes(1)
      expect(onDetailedObserver).toHaveBeenCalledWith(
        { mesh, data: { image: frontImage } },
        expect.anything()
      )
    })

    it('can show back image', () => {
      mesh.metadata.isFlipped = true
      mesh.metadata.detail()
      expect(onDetailedObserver).toHaveBeenCalledTimes(1)
      expect(onDetailedObserver).toHaveBeenCalledWith(
        { mesh, data: { image: backImage } },
        expect.anything()
      )
    })
  })
})
