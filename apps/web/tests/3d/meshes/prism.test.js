import { Color4 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { controlManager, materialManager } from '@src/3d/managers'
import { createPrism } from '@src/3d/meshes'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { configures3dTestEngine, expectPosition } from '../../test-utils'

let scene
configures3dTestEngine(created => (scene = created.scene))

beforeAll(() => materialManager.init({ scene }))

describe('createPrism()', () => {
  it('creates a prism with default values and no behavior', () => {
    const mesh = createPrism()
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

  it('creates a prism with a single color', () => {
    const color = '#1E282F'
    const mesh = createPrism({ texture: color })
    const { boundingBox } = mesh.getBoundingInfo()
    expect(mesh.name).toEqual('prism')
    expect(boundingBox.extendSize.x * 2).toEqual(3)
    expect(boundingBox.extendSize.y * 2).toEqual(1)
    expect(mesh.isPickable).toBe(false)
    expect(mesh.material.diffuseColor).toEqual(Color4.FromHexString(color))
  })

  describe('given a prism with initial position, edges number, dimension, images and behaviors', () => {
    let mesh

    const width = faker.datatype.number({ min: 3, max: 5 })
    const edges = faker.datatype.number({ min: 8, max: 20 })
    const height = faker.datatype.number({ min: 5, max: 8 })
    const id = faker.datatype.uuid()
    const x = faker.datatype.number()
    const y = faker.datatype.number()
    const z = faker.datatype.number()
    const prismRotation = faker.datatype.number()
    const faceUV = [
      Array.from({ length: 4 }, () => faker.datatype.number()),
      Array.from({ length: 4 }, () => faker.datatype.number()),
      Array.from({ length: 4 }, () => faker.datatype.number())
    ]
    const behaviors = {
      movable: { kind: faker.lorem.word() },
      rotable: { angle: Math.PI },
      detailable: {
        frontImage: faker.internet.url(),
        backImage: faker.internet.url()
      }
    }

    beforeEach(() => {
      mesh = createPrism({
        id,
        edges,
        prismRotation,
        width,
        height,
        x,
        y,
        z,
        faceUV,
        ...behaviors
      })
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
      expect(controlManager.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(controlManager.isManaging(mesh)).toBe(false)
    })

    it('serialize with its state', () => {
      expect(mesh.metadata.serialize()).toEqual({
        shape: 'prism',
        id,
        x,
        y,
        z,
        faceUV,
        width,
        edges,
        prismRotation,
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
