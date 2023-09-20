// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Observer<?>} Observer
 * @typedef {import('@babylonjs/core').Scene} Scene
 */

import { Vector3 } from '@babylonjs/core'
import { faker } from '@faker-js/faker'
import {
  DetailBehavior,
  DetailBehaviorName,
  StackBehaviorName
} from '@src/3d/behaviors'
import { StackBehavior } from '@src/3d/behaviors/stackable'
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
  /** @type {import('@src/3d/managers').Managers} */
  let managers

  configures3dTestEngine(created => {
    managers = created.managers
  })

  const onDetailsReceived = vi.fn()
  /** @type {?Observer} */
  let onDetailsObserver

  beforeEach(() => {
    vi.clearAllMocks()
  })

  beforeAll(() => {
    onDetailsObserver =
      managers.control.onDetailedObservable.add(onDetailsReceived)
  })

  afterAll(() => {
    managers.control.onDetailedObservable.remove(onDetailsObserver)
  })

  it('has initial state', () => {
    const state = {
      frontImage: faker.image.url(),
      backImage: faker.image.url()
    }
    const behavior = new DetailBehavior(state, managers)
    const mesh = createBox('box', {})

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(DetailBehaviorName)
    expect(behavior.state).toEqual(state)

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('can not restore state without mesh', () => {
    expect(() =>
      new DetailBehavior({ frontImage: '' }, managers).fromState({
        frontImage: ''
      })
    ).toThrow('Can not restore state without mesh')
  })

  it('can not show details without mesh', () => {
    const behavior = new DetailBehavior({ frontImage: '' }, managers)
    behavior.detail?.()
    expect(onDetailsReceived).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const behavior = new DetailBehavior({ frontImage: '' }, managers)
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
      // @ts-expect-error -- image types are different
      behavior = new DetailBehavior({ frontImage, backImage }, managers)
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
        {
          position: { x: 1024, y: 512 },
          images: frontImage ? [frontImage] : []
        },
        expect.anything()
      )
    })

    it('can show back image', () => {
      mesh.metadata.isFlipped = true
      mesh.metadata.detail?.()
      expect(onDetailsReceived).toHaveBeenCalledTimes(1)
      expect(onDetailsReceived).toHaveBeenCalledWith(
        { position: { x: 1024, y: 512 }, images: backImage ? [backImage] : [] },
        expect.anything()
      )
    })
  })

  describe('given attached to a stacked mesh', () => {
    /** @type {Mesh} */
    let mesh
    const images = ['image1', 'image2', 'image3']

    beforeEach(() => {
      ;[, mesh] = images.map((frontImage, rank) => {
        const box = createBox(`box${rank + 1}`, {})
        box.setAbsolutePosition(new Vector3(rank, rank, rank))
        box.addBehavior(new StackBehavior({ duration: 10 }, managers), true)
        box.addBehavior(new DetailBehavior({ frontImage }, managers), true)
        return box
      })
      mesh
        .getBehaviorByName(StackBehaviorName)
        ?.fromState({ stackIds: ['box1', 'box3'] })
    })

    it('shows all stacked meshes, reverse', () => {
      mesh.metadata.detail?.()
      expect(onDetailsReceived).toHaveBeenCalledTimes(1)
      expect(onDetailsReceived).toHaveBeenCalledWith(
        {
          position: { x: 1048.4849005729236, y: 480.00893477155284 },
          images: ['image3', 'image1', 'image2']
        },
        expect.anything()
      )
    })

    it('omits meshes with no images', () => {
      const box = createBox(`box4`, {})
      box.addBehavior(new StackBehavior({ duration: 10 }, managers), true)
      mesh.metadata.push?.(box.id, true)
      mesh.metadata.detail?.()
      expect(onDetailsReceived).toHaveBeenCalledTimes(1)
      expect(onDetailsReceived).toHaveBeenCalledWith(
        {
          position: { x: 1048.4849005729236, y: 480.00893477155284 },
          images: ['image3', 'image1', 'image2']
        },
        expect.anything()
      )
    })
  })
})
