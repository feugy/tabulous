import { Color4 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { controlManager, materialManager } from '@src/3d/managers'
import { createRoundToken } from '@src/3d/meshes'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  configures3dTestEngine,
  expectDimension,
  expectPosition
} from '../../test-utils'

let scene
configures3dTestEngine(created => (scene = created.scene))

beforeAll(() => materialManager.init({ scene }))

describe('createRoundToken()', () => {
  it('creates a token with default values and no behavior', async () => {
    const mesh = await createRoundToken()
    expect(mesh.name).toEqual('roundToken')
    expectDimension(mesh, [2, 0.1, 2])
    expect(mesh.isPickable).toBe(false)
    expect(mesh.isCylindric).toBe(true)
    expectPosition(mesh, [0, 0.05, 0])
    expect(mesh.metadata).toEqual({
      serialize: expect.any(Function)
    })
    expect(mesh.behaviors).toHaveLength(0)
  })

  it('creates a token with a single color', async () => {
    const color = '#1E282F'
    const mesh = await createRoundToken({ texture: color })
    expect(mesh.name).toEqual('roundToken')
    expectDimension(mesh, [2, 0.1, 2])
    expect(mesh.isPickable).toBe(false)
    expect(mesh.material.diffuseColor).toEqual(
      Color4.FromHexString(color).toLinearSpace()
    )
  })

  it('creates a token with initial transformation', async () => {
    const mesh = await createRoundToken({
      dimension: 4,
      transform: { roll: Math.PI * -0.5 }
    })
    expect(mesh.name).toEqual('roundToken')
    expectDimension(mesh, [0.05, 2, 2])
  })

  describe('given a token with initial position, dimension, images and behaviors', () => {
    let mesh

    const diameter = faker.number.int(999)
    const height = faker.number.int(999)
    const id = faker.string.uuid()
    const x = faker.number.int(999)
    const y = faker.number.int(999)
    const z = faker.number.int(999)
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
      mesh = await createRoundToken({
        id,
        diameter,
        height,
        x,
        y,
        z,
        faceUV,
        ...behaviors
      })
    })

    it('has all the expected data', () => {
      expect(mesh.name).toEqual('roundToken')
      expect(mesh.id).toEqual(id)
      expectDimension(mesh, [diameter, height, diameter])
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

    it('unregisters token from controllables on disposal', () => {
      expect(controlManager.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(controlManager.isManaging(mesh)).toBe(false)
    })

    it('serialize with its state', () => {
      expect(mesh.metadata.serialize()).toEqual({
        shape: 'roundToken',
        id,
        x,
        y,
        z,
        faceUV,
        diameter,
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
