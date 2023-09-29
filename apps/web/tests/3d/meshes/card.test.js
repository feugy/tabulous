// @ts-check
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { createCard } from '@src/3d/meshes'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  configures3dTestEngine,
  expectDimension,
  expectPosition
} from '../../test-utils'

/** @type {import('@babylonjs/core').Scene} */
let scene
/** @type {import('@src/3d/managers').Managers} */
let managers

configures3dTestEngine(created => {
  scene = created.scene
  managers = created.managers
})

describe('createCard()', () => {
  it('creates a card with default values, faces and no behavior', async () => {
    const mesh = await createCard({ id: '', texture: '' }, managers, scene)
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
    const mesh = await createCard({ id: '', texture: color }, managers, scene)
    expect(mesh.name).toEqual('card')
    expectDimension(mesh, [3, 0.01, 4.25])
    expect(mesh.isPickable).toBe(false)
    expect(
      /** @type {import('@babylonjs/core').StandardMaterial} */ (mesh.material)
        .diffuseColor
    ).toEqual(Color3.FromHexString(color).toLinearSpace())
  })

  it('creates a card with initial transformation', async () => {
    const mesh = await createCard(
      {
        id: '',
        texture: '',
        width: 4,
        depth: 2,
        transform: { yaw: Math.PI * -0.5 }
      },
      managers,
      scene
    )
    expect(mesh.name).toEqual('card')
    expectDimension(mesh, [2, 0.1, 4])
  })

  describe('given a card with initial position, dimension, images and behaviors', async () => {
    /** @type {import('@babylonjs/core').Mesh} */
    let mesh

    const width = faker.number.int(999)
    const height = faker.number.int(999)
    const id = faker.string.uuid()
    const depth = faker.number.int(999)
    const texture = faker.color.rgb()
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
      mesh = await createCard(
        {
          id,
          texture,
          width,
          height,
          depth,
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
      expect(managers.control.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(managers.control.isManaging(mesh)).toBe(false)
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
        texture,
        faceUV,
        detailable: behaviors.detailable,
        rotable: { ...behaviors.rotable, duration: 200 },
        movable: { ...behaviors.movable, duration: 100, snapDistance: 0.25 }
      })
    })
  })
})
