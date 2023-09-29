// @ts-check
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { createRoundToken } from '@src/3d/meshes'
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

describe('createRoundToken()', () => {
  it('creates a token with default values and no behavior', async () => {
    const mesh = await createRoundToken(
      { id: '', texture: '' },
      managers,
      scene
    )
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
    const mesh = await createRoundToken(
      { id: '', texture: color },
      managers,
      scene
    )
    expect(mesh.name).toEqual('roundToken')
    expectDimension(mesh, [2, 0.1, 2])
    expect(mesh.isPickable).toBe(false)
    expect(
      /** @type {import('@babylonjs/core').StandardMaterial} */ (mesh.material)
        .diffuseColor
    ).toEqual(Color3.FromHexString(color).toLinearSpace())
  })

  it('creates a token with initial transformation', async () => {
    const mesh = await createRoundToken(
      {
        id: '',
        texture: '',
        diameter: 2,
        transform: { roll: Math.PI * -0.5 }
      },
      managers,
      scene
    )
    expect(mesh.name).toEqual('roundToken')
    expectDimension(mesh, [0.05, 2, 2])
  })

  describe('given a token with initial position, dimension, images and behaviors', () => {
    /** @type {import('@babylonjs/core').Mesh} */
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
    const texture = faker.color.rgb()
    const behaviors = {
      movable: { kind: faker.lorem.word() },
      rotable: { angle: Math.PI },
      detailable: {
        frontImage: faker.internet.url(),
        backImage: faker.internet.url()
      }
    }

    beforeEach(async () => {
      mesh = await createRoundToken(
        {
          id,
          texture,
          diameter,
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
      expect(managers.control.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(managers.control.isManaging(mesh)).toBe(false)
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
        texture,
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
