import { Color4 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { controlManager, materialManager } from '@src/3d/managers'
import { createBox } from '@src/3d/meshes'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  configures3dTestEngine,
  expectDimension,
  expectPosition
} from '../../test-utils'

let scene
configures3dTestEngine(created => (scene = created.scene))

beforeAll(() => materialManager.init({ scene }))

describe('createBox()', () => {
  it('creates a box with default values, faces and no behavior', async () => {
    const mesh = await createBox()
    expect(mesh.name).toEqual('box')
    expectDimension(mesh, [1, 1, 1])
    expect(mesh.isPickable).toBe(false)
    expectPosition(mesh, [0, 0.5, 0])
    expect(mesh.metadata).toEqual({
      serialize: expect.any(Function)
    })
    expect(mesh.behaviors).toHaveLength(0)
  })

  it('creates a box with a single color', async () => {
    const color = '#1E282F'
    const mesh = await createBox({ texture: color })
    expect(mesh.name).toEqual('box')
    expectDimension(mesh, [1, 1, 1])
    expect(mesh.isPickable).toBe(false)
    expect(mesh.material.diffuseColor).toEqual(
      Color4.FromHexString(color).toLinearSpace()
    )
  })

  it('creates a box with initial transformation', async () => {
    const mesh = await createBox({
      width: 4,
      height: 8,
      depth: 2,
      transform: { pitch: Math.PI * -0.5 }
    })
    expect(mesh.name).toEqual('box')
    expectDimension(mesh, [2, 8, 4])
  })

  describe('given a box with initial position, dimension, images and behaviors', () => {
    let mesh

    const width = faker.number.int(999)
    const height = faker.number.int(999)
    const id = faker.string.uuid()
    const depth = faker.number.int(999)
    const x = faker.number.int(999)
    const y = faker.number.int(999)
    const z = faker.number.int(999)
    const faceUV = [
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
      mesh = await createBox({
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
      expect(mesh.name).toEqual('box')
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

    it('unregisters box from controllables on disposal', () => {
      expect(controlManager.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(controlManager.isManaging(mesh)).toBe(false)
    })

    it('serialize with its state', () => {
      expect(mesh.metadata.serialize()).toEqual({
        shape: 'box',
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
