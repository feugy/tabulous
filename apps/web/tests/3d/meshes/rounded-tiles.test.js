import { Color4 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { controlManager, materialManager } from '@src/3d/managers'
import { createRoundedTile } from '@src/3d/meshes'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  configures3dTestEngine,
  expectDimension,
  expectPosition
} from '../../test-utils'

let scene
configures3dTestEngine(created => (scene = created.scene))

beforeAll(() => materialManager.init({ scene }))

describe('createRoundedTile()', () => {
  it('creates a tile with default values and no behavior', async () => {
    const mesh = await createRoundedTile()
    expect(mesh.name).toEqual('roundedTile')
    expectDimension(mesh, [3, 0.05, 3])
    expect(mesh.isPickable).toBe(false)
    expectPosition(mesh, [0, 0, 0])
    expect(mesh.metadata).toEqual({
      serialize: expect.any(Function)
    })
    expect(mesh.behaviors).toHaveLength(0)
  })

  it('creates a tile with a single color', async () => {
    const color = '#1E282F'
    const mesh = await createRoundedTile({ texture: color })
    expect(mesh.name).toEqual('roundedTile')
    expectDimension(mesh, [3, 0.05, 3])
    expect(mesh.isPickable).toBe(false)
    expect(mesh.material.diffuseColor).toEqual(
      Color4.FromHexString(color).toLinearSpace()
    )
  })

  it('creates a tile with initial transformation', async () => {
    const mesh = await createRoundedTile({
      width: 4,
      height: 8,
      depth: 2,
      transform: { pitch: Math.PI * -0.5 }
    })
    expect(mesh.name).toEqual('roundedTile')
    expectDimension(mesh, [2, 8, 4])
  })

  describe('given a tile with initial position, dimension, images and behaviors', () => {
    let mesh

    const width = faker.number.int(999)
    const height = faker.number.int(999)
    const depth = faker.number.int(999)
    const id = faker.string.uuid()
    const x = faker.number.int(999)
    const y = faker.number.int(999)
    const z = faker.number.int(999)
    const faceUV = Array.from({ length: 6 }, () =>
      Array.from({ length: 4 }, () => faker.number.int(999))
    )
    const behaviors = {
      anchorable: {
        anchors: [
          {
            width: width * 0.5,
            height: height * 0.5,
            kinds: [faker.lorem.word()]
          }
        ]
      },
      flippable: { isFlipped: faker.datatype.boolean() },
      detailable: {
        frontImage: faker.internet.url(),
        backImage: faker.internet.url()
      }
    }
    const borderRadius = Math.random()

    beforeEach(async () => {
      mesh = await createRoundedTile({
        id,
        width,
        height,
        depth,
        faceUV,
        x,
        y,
        z,
        borderRadius,
        ...behaviors
      })
    })

    it('has all the expected data', () => {
      expect(mesh.name).toEqual('roundedTile')
      expect(mesh.id).toEqual(id)
      expectDimension(mesh, [width, height, depth])
      expect(mesh.isPickable).toBe(false)
      expectPosition(mesh, [x, y, z])
      expect(mesh.getBehaviorByName('detailable')).toBeDefined()
      expect(mesh.getBehaviorByName('anchorable')?.state).toEqual(
        expect.objectContaining(behaviors.anchorable)
      )
      expect(mesh.getBehaviorByName('flippable')?.state).toEqual(
        expect.objectContaining(behaviors.flippable)
      )
      expect(mesh.metadata).toEqual({
        ...behaviors.detailable,
        ...behaviors.anchorable,
        isFlipped: behaviors.flippable.isFlipped,
        serialize: expect.any(Function),
        detail: expect.any(Function),
        flip: expect.any(Function),
        snap: expect.any(Function),
        unsnap: expect.any(Function),
        unsnapAll: expect.any(Function)
      })
    })

    it('unregisters mesh from controllables on disposal', () => {
      expect(controlManager.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(controlManager.isManaging(mesh)).toBe(false)
    })

    it('serialize with its state', () => {
      expect(mesh.metadata.serialize()).toEqual({
        shape: 'roundedTile',
        id,
        x,
        y,
        z,
        faceUV,
        width,
        height,
        depth,
        borderRadius,
        detailable: behaviors.detailable,
        flippable: {
          ...behaviors.flippable,
          duration: 500
        },
        anchorable: {
          ...behaviors.anchorable,
          duration: 100
        }
      })
    })
  })
})
