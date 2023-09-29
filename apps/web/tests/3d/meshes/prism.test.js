// @ts-check
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { createPrism } from '@src/3d/meshes'
import { beforeEach, describe, expect, it } from 'vitest'

import { configures3dTestEngine, expectPosition } from '../../test-utils'

/** @type {import('@babylonjs/core').Scene} */
let scene
/** @type {import('@src/3d/managers').Managers} */
let managers

configures3dTestEngine(created => {
  scene = created.scene
  managers = created.managers
})

describe('createPrism()', () => {
  it('creates a prism with default values and no behavior', async () => {
    const mesh = await createPrism({ id: '', texture: '' }, managers, scene)
    const { boundingBox } = mesh.getBoundingInfo()
    expect(mesh.name).toEqual('prism')
    expect(boundingBox.extendSize.x * 2).toEqual(3)
    expect(boundingBox.extendSize.y * 2).toEqual(1)
    expect(mesh.isPickable).toBe(false)
    expect(mesh.isCylindric).toBe(true)
    expectPosition(mesh, [0, 0.5, 0])
    expect(mesh.metadata).toEqual({
      serialize: expect.any(Function)
    })
    expect(mesh.behaviors).toHaveLength(0)
  })

  it('creates a prism with a single color', async () => {
    const color = '#1E282F'
    const mesh = await createPrism({ id: '', texture: color }, managers, scene)
    const { boundingBox } = mesh.getBoundingInfo()
    expect(mesh.name).toEqual('prism')
    expect(boundingBox.extendSize.x * 2).toEqual(3)
    expect(boundingBox.extendSize.y * 2).toEqual(1)
    expect(mesh.isPickable).toBe(false)
    expect(
      /** @type {import('@babylonjs/core').StandardMaterial} */ (mesh.material)
        .diffuseColor
    ).toEqual(Color3.FromHexString(color).toLinearSpace())
  })

  it('creates a prism with initial transformation', async () => {
    const mesh = await createPrism(
      {
        id: '',
        texture: '',
        diameter: 2,
        transform: { roll: Math.PI * -0.5 }
      },
      managers,
      scene
    )
    const { boundingBox } = mesh.getBoundingInfo()
    expect(mesh.name).toEqual('prism')
    expect(boundingBox.extendSize.x * 2).toBeCloseTo(1)
    expect(boundingBox.extendSize.y * 2).toBeCloseTo(3)
  })

  describe('given a prism with initial position, edges number, dimension, images and behaviors', () => {
    /** @type {import('@babylonjs/core').Mesh} */
    let mesh

    const width = faker.number.int({ min: 3, max: 5 })
    const edges = faker.number.int({ min: 8, max: 20 })
    const height = faker.number.int({ min: 5, max: 8 })
    const id = faker.string.uuid()
    const x = faker.number.int(999)
    const y = faker.number.int(999)
    const z = faker.number.int(999)
    const texture = faker.color.rgb()
    const faceUV = [
      Array.from({ length: 4 }, () => faker.number.int(999)),
      Array.from({ length: 4 }, () => faker.number.int(999)),
      Array.from({ length: 4 }, () => faker.number.int(999))
    ]
    const behaviors = {
      movable: { kind: faker.lorem.word() },
      rotable: { angle: Math.PI },
      detailable: {
        frontImage: faker.internet.url(),
        backImage: faker.internet.url()
      }
    }

    beforeEach(async () => {
      mesh = await createPrism(
        {
          id,
          texture,
          edges,
          width,
          height,
          x,
          y,
          z,
          faceUV,
          ...behaviors
        },
        managers,
        scene
      )
    })

    it('has all the expected data', () => {
      const { boundingBox } = mesh.getBoundingInfo()
      expect(mesh.name).toEqual('prism')
      expect(mesh.id).toEqual(id)
      expect(boundingBox.extendSize.x * 2).toBeCloseTo(width, 0)
      expect(boundingBox.extendSize.y * 2).toEqual(height)
      expect(mesh.isPickable).toBe(true)
      expectPosition(mesh, [x, y, z])
      expect(mesh.getBehaviorByName('detailable')).toBeDefined()
      expect(mesh.getBehaviorByName('movable')?.state).toEqual(
        expect.objectContaining(behaviors.movable)
      )
      expect(mesh.getBehaviorByName('rotable')?.state).toEqual(
        expect.objectContaining(behaviors.rotable)
      )
      expect(mesh.metadata).toEqual({
        ...behaviors.detailable,
        angle: behaviors.rotable.angle,
        serialize: expect.any(Function),
        detail: expect.any(Function),
        rotate: expect.any(Function)
      })
    })

    it('unregisters prism from controllables on disposal', () => {
      expect(managers.control.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(managers.control.isManaging(mesh)).toBe(false)
    })

    it('serialize with its state', () => {
      expect(mesh.metadata.serialize()).toEqual({
        shape: 'prism',
        id,
        x,
        y,
        z,
        texture,
        faceUV,
        width,
        edges,
        height,
        detailable: behaviors.detailable,
        rotable: {
          ...behaviors.rotable,
          duration: 200
        },
        movable: {
          ...behaviors.movable,
          duration: 100,
          snapDistance: 0.25
        }
      })
    })
  })
})
