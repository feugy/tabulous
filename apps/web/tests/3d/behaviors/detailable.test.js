// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Observer<?>} Observer
 */

import { faker } from '@faker-js/faker'
import { DetailBehavior, DetailBehaviorName } from '@src/3d/behaviors'
import { controlManager } from '@src/3d/managers'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import { configures3dTestEngine, createBox } from '../../test-utils'

describe('DetailBehavior', () => {
  configures3dTestEngine()

  const onDetailsReceived = vi.fn()
  /** @type {?Observer} */
  let onDetailsObserver

  beforeEach(() => {
    vi.resetAllMocks()
  })

  beforeAll(() => {
    onDetailsObserver =
      controlManager.onDetailedObservable.add(onDetailsReceived)
  })

  afterAll(() => {
    controlManager.onDetailedObservable.remove(onDetailsObserver)
  })

  it('has initial state', () => {
    const state = {
      frontImage: faker.image.url(),
      backImage: faker.image.url()
    }
    const behavior = new DetailBehavior(state)
    const mesh = createBox('box', {})

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(DetailBehaviorName)
    expect(behavior.state).toEqual(state)

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('can not restore state without mesh', () => {
    expect(() => new DetailBehavior().fromState({ frontImage: '' })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can not show details without mesh', () => {
    const behavior = new DetailBehavior()
    behavior.detail?.()
    expect(onDetailsReceived).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const behavior = new DetailBehavior()
    const mesh = createBox('box', {})
    mesh.addBehavior(behavior, true)

    behavior.fromState({ frontImage: '' })
    expect(behavior.state).toEqual({ frontImage: '' })
    expect(behavior.mesh).toEqual(mesh)
    expect(mesh.metadata.frontImage).toBe('')
    expect(mesh.metadata.backImage).toBeUndefined()
  })

  describe.each([
    {
      title: ' with images',
      frontImage: faker.image.url(),
      backImage: faker.image.url()
    },
    {
      title: ' with no images',
      frontImage: null,
      backImage: null
    }
  ])('given attached to a mesh$title', ({ frontImage, backImage }) => {
    /** @type {Mesh} */
    let mesh
    /** @type {DetailBehavior} */
    let behavior

    beforeEach(() => {
      // @ts-expect-error image types are different
      behavior = new DetailBehavior({ frontImage, backImage })
      mesh = createBox('box', {})
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
      mesh.metadata.detail?.()
      expect(onDetailsReceived).toHaveBeenCalledTimes(1)
      expect(onDetailsReceived).toHaveBeenCalledWith(
        { mesh, data: { image: frontImage } },
        expect.anything()
      )
    })

    it('can show back image', () => {
      mesh.metadata.isFlipped = true
      mesh.metadata.detail?.()
      expect(onDetailsReceived).toHaveBeenCalledTimes(1)
      expect(onDetailsReceived).toHaveBeenCalledWith(
        { mesh, data: { image: backImage } },
        expect.anything()
      )
    })
  })
})
