import { Color4 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { createBox } from '../../../src/3d/meshes'
import { controlManager, materialManager } from '../../../src/3d/managers'
import { configures3dTestEngine, expectPosition } from '../../test-utils'

let scene
configures3dTestEngine(created => (scene = created.scene))

beforeAll(() => materialManager.init({ scene }))

describe('createBox()', () => {
  it('creates a box with default values, faces and no behavior', () => {
    const mesh = createBox()
    const { boundingBox } = mesh.getBoundingInfo()
    expect(mesh.name).toEqual('box')
    expect(boundingBox.extendSize.x * 2).toEqual(1)
    expect(boundingBox.extendSize.z * 2).toEqual(1)
    expect(boundingBox.extendSize.y * 2).toEqual(1)
    expect(mesh.isPickable).toBe(false)
    expectPosition(mesh, [0, 0.5, 0])
    expect(mesh.metadata).toEqual({
      serialize: expect.any(Function)
    })
    expect(mesh.behaviors).toHaveLength(0)
  })

  it('creates a box with a single color', () => {
    const color = '#1E282F'
    const mesh = createBox({ texture: color })
    const { boundingBox } = mesh.getBoundingInfo()
    expect(mesh.name).toEqual('box')
    expect(boundingBox.extendSize.x * 2).toEqual(1)
    expect(boundingBox.extendSize.z * 2).toEqual(1)
    expect(boundingBox.extendSize.y * 2).toEqual(1)
    expect(mesh.isPickable).toBe(false)
    expect(mesh.material.diffuseColor).toEqual(Color4.FromHexString(color))
  })

  describe('given a box with initial position, dimension, images and behaviors', () => {
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

    beforeEach(() => {
      mesh = createBox({
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
      const { boundingBox } = mesh.getBoundingInfo()
      expect(mesh.name).toEqual('box')
      expect(mesh.id).toEqual(id)
      expect(boundingBox.extendSize.x * 2).toEqual(width)
      expect(boundingBox.extendSize.y * 2).toEqual(height)
      expect(boundingBox.extendSize.z * 2).toEqual(depth)
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