import { Color4 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { createRoundedTile } from '../../../src/3d/meshes'
import { controlManager, materialManager } from '../../../src/3d/managers'
import { configures3dTestEngine } from '../../test-utils'

let scene
configures3dTestEngine(created => (scene = created.scene))

beforeAll(() => materialManager.init({ scene }))

describe('createRoundedTile()', () => {
  it('creates a tile with default values and no behavior', () => {
    const mesh = createRoundedTile()
    const { boundingBox } = mesh.getBoundingInfo()
    expect(mesh.name).toEqual('roundedTile')
    expect(boundingBox.extendSize.x * 2).toEqual(3)
    expect(boundingBox.extendSize.z * 2).toEqual(3)
    expect(boundingBox.extendSize.y * 2).toEqual(0.05)
    expect(mesh.isPickable).toBe(false)
    expect(mesh.absolutePosition.x).toEqual(0)
    expect(mesh.absolutePosition.y).toBeCloseTo(0.05, -0.01)
    expect(mesh.absolutePosition.z).toEqual(0)
    expect(mesh.metadata).toEqual({
      serialize: expect.any(Function)
    })
    expect(mesh.behaviors).toHaveLength(0)
  })

  it('creates a card with a single color', () => {
    const color = '#1E282F'
    const mesh = createRoundedTile({ texture: color })
    const { boundingBox } = mesh.getBoundingInfo()
    expect(mesh.name).toEqual('roundedTile')
    expect(boundingBox.extendSize.x * 2).toEqual(3)
    expect(boundingBox.extendSize.z * 2).toEqual(3)
    expect(boundingBox.extendSize.y * 2).toEqual(0.05)
    expect(mesh.isPickable).toBe(false)
    expect(mesh.material.diffuseColor).toEqual(Color4.FromHexString(color))
  })

  describe('given a tile with initial position, dimension, images and behaviors', () => {
    let mesh

    const width = faker.datatype.number()
    const height = faker.datatype.number()
    const depth = faker.datatype.number()
    const id = faker.datatype.uuid()
    const x = faker.datatype.number()
    const y = faker.datatype.number()
    const z = faker.datatype.number()
    const faceUV = Array.from({ length: 6 }, () =>
      Array.from({ length: 4 }, () => faker.datatype.number())
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

    beforeEach(() => {
      mesh = createRoundedTile({
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
      const { boundingBox } = mesh.getBoundingInfo()
      expect(mesh.name).toEqual('roundedTile')
      expect(mesh.id).toEqual(id)
      expect(boundingBox.extendSize.x * 2).toEqual(width)
      expect(boundingBox.extendSize.y * 2).toEqual(height)
      expect(boundingBox.extendSize.z * 2).toEqual(depth)
      expect(mesh.isPickable).toBe(false)
      expect(mesh.absolutePosition.x).toEqual(x)
      expect(mesh.absolutePosition.y).toEqual(y)
      expect(mesh.absolutePosition.z).toEqual(z)
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
