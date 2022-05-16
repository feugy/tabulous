import { Color4 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { createRoundToken } from '../../../src/3d/meshes'
import { controlManager, materialManager } from '../../../src/3d/managers'
import {
  configures3dTestEngine,
  expectDimension,
  expectPosition
} from '../../test-utils'

let scene
configures3dTestEngine(created => (scene = created.scene))

beforeAll(() => materialManager.init({ scene }))

describe('createRoundToken()', () => {
  it('creates a token with default values and no behavior', () => {
    const mesh = createRoundToken()
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

  it('creates a card with a single color', () => {
    const color = '#1E282F'
    const mesh = createRoundToken({ texture: color })
    expect(mesh.name).toEqual('roundToken')
    expectDimension(mesh, [2, 0.1, 2])
    expect(mesh.isPickable).toBe(false)
    expect(mesh.material.diffuseColor).toEqual(Color4.FromHexString(color))
  })

  describe('given a token with initial position, dimension, images and behaviors', () => {
    let mesh

    const diameter = faker.datatype.number()
    const height = faker.datatype.number()
    const id = faker.datatype.uuid()
    const x = faker.datatype.number()
    const y = faker.datatype.number()
    const z = faker.datatype.number()
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
      mesh = createRoundToken({
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
