import faker from 'faker'
import { createCard } from '../../src/3d'
import { controlManager } from '../../src/3d/managers'
import { configures3dTestEngine } from '../test-utils'

configures3dTestEngine()

describe('createCard()', () => {
  it('creates a card with default values, faces and no behavior', () => {
    const mesh = createCard()
    const { boundingBox } = mesh.getBoundingInfo()
    expect(mesh.name).toEqual('card')
    expect(boundingBox.extendSize.x * 2).toEqual(3)
    expect(boundingBox.extendSize.z * 2).toEqual(4.25)
    expect(boundingBox.extendSize.y * 2).toEqual(0.01)
    expect(mesh.isPickable).toBe(false)
    expect(mesh.absolutePosition.x).toEqual(0)
    expect(mesh.absolutePosition.y).toEqual(0)
    expect(mesh.absolutePosition.z).toEqual(0)
    expect(mesh.metadata).toEqual({
      images: undefined,
      serialize: expect.any(Function)
    })
    expect(mesh.getChildren()).toHaveLength(1)
    expect(mesh.getChildren()[0].isPickable).toBe(false)
    expect(mesh.behaviors).toHaveLength(0)
  })

  describe('given a card with initial position, dimension, images and behaviors', () => {
    let mesh

    const width = faker.datatype.number()
    const height = faker.datatype.number()
    const id = faker.datatype.uuid()
    const depth = faker.datatype.number()
    const x = faker.datatype.number()
    const y = faker.datatype.number()
    const z = faker.datatype.number()
    const images = { front: faker.internet.url(), back: faker.internet.url() }
    const behaviors = {
      movable: { kind: faker.lorem.word() },
      rotable: { angle: Math.PI },
      detailable: true
    }

    beforeEach(() => {
      mesh = createCard({
        id,
        width,
        height,
        depth,
        x,
        y,
        z,
        images,
        ...behaviors
      })
    })

    it('has all the expected data', () => {
      const { boundingBox } = mesh.getBoundingInfo()
      expect(mesh.name).toEqual('card')
      expect(mesh.id).toEqual(id)
      expect(boundingBox.extendSize.x * 2).toEqual(width)
      expect(boundingBox.extendSize.z * 2).toEqual(height)
      expect(boundingBox.extendSize.y * 2).toEqual(depth)
      expect(mesh.isPickable).toBe(true)
      expect(mesh.absolutePosition.x).toEqual(x)
      expect(mesh.absolutePosition.y).toEqual(y)
      expect(mesh.absolutePosition.z).toEqual(z)
      expect(mesh.getChildren()).toHaveLength(1)
      expect(mesh.getChildren()[0].isPickable).toBe(false)
      expect(mesh.getBehaviorByName('detailable')).toBeDefined()
      expect(mesh.getBehaviorByName('movable')?.state).toEqual(
        expect.objectContaining(behaviors.movable)
      )
      expect(mesh.getBehaviorByName('rotable')?.state).toEqual(
        expect.objectContaining(behaviors.rotable)
      )
      expect(mesh.metadata).toEqual({
        images,
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

    it('can render overlay', () => {
      mesh.renderOverlay = true
      expect(mesh.renderOverlay).toBe(true)
      expect(mesh.getChildren()[0].renderOverlay).toBe(true)
      mesh.renderOverlay = false
      expect(mesh.renderOverlay).toBe(false)
      expect(mesh.getChildren()[0].renderOverlay).toBe(false)
    })

    it('serialize with its state', () => {
      expect(mesh.metadata.serialize()).toEqual({
        id,
        x,
        y,
        z,
        width,
        height,
        depth,
        images,
        detailable: true,
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
