import { Color4 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { controlManager, materialManager } from '@src/3d/managers'
import { createCard } from '@src/3d/meshes'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  configures3dTestEngine,
  expectDimension,
  expectPosition
} from '../../test-utils'

let scene
configures3dTestEngine(created => (scene = created.scene))

beforeAll(() => materialManager.init({ scene }))

describe('createCard()', () => {
  it('creates a card with default values, faces and no behavior', async () => {
    const mesh = await createCard()
    expect(mesh.name).toEqual('card')
    expectDimension(mesh, [3, 0.01, 4.25])
    expect(mesh.isPickable).toBe(false)
    expectPosition(mesh, [0, 0, 0])
    expect(mesh.metadata).toEqual({
      images: undefined,
      serialize: expect.any(Function)
    })
    expect(mesh.behaviors).toHaveLength(0)
  })

  it('creates a card with a single color', async () => {
    const color = '#1E282F'
    const mesh = await createCard({ texture: color })
    expect(mesh.name).toEqual('card')
    expectDimension(mesh, [3, 0.01, 4.25])
    expect(mesh.isPickable).toBe(false)
    expect(mesh.material.diffuseColor).toEqual(
      Color4.FromHexString(color).toLinearSpace()
    )
  })

  describe('given a card with initial position, dimension, images and behaviors', async () => {
    let mesh

    const width = faker.datatype.number()
    const height = faker.datatype.number()
    const id = faker.datatype.uuid()
    const depth = faker.datatype.number()
    const x = faker.datatype.number()
    const y = faker.datatype.number()
    const z = faker.datatype.number()
    const faceUV = [
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

    beforeEach(async () => {
      mesh = await createCard({
        id,
        width,
        height,
        depth,
        x,
        y,
        z,
        faceUV,
        ...behaviors
      })
    })

    it('has all the expected data', () => {
      expect(mesh.name).toEqual('card')
      expect(mesh.id).toEqual(id)
      expectDimension(mesh, [width, height, depth])
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

    it('unregisters card from controllables on disposal', () => {
      expect(controlManager.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(controlManager.isManaging(mesh)).toBe(false)
    })

    it('serialize with its state', () => {
      expect(mesh.metadata.serialize()).toEqual({
        shape: 'card',
        id,
        x,
        y,
        z,
        width,
        height,
        depth,
        faceUV,
        detailable: behaviors.detailable,
        rotable: { ...behaviors.rotable, duration: 200 },
        movable: { ...behaviors.movable, duration: 100, snapDistance: 0.25 }
      })
    })
  })
})
