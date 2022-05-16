import { Color4 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import {
  controlManager,
  customShapeManager,
  materialManager
} from '../../../src/3d/managers'
import { createCustom } from '../../../src/3d/meshes'
import { getDimensions } from '../../../src/3d/utils'
import {
  configures3dTestEngine,
  expectDimension,
  expectPosition
} from '../../test-utils'
import pawnData from '../../fixtures/pawn.json'

let scene
configures3dTestEngine(created => (scene = created.scene))

beforeAll(() => materialManager.init({ scene }))

jest.mock('../../../src/3d/managers/custom-shape', () => ({
  customShapeManager: new Map()
}))

const file = 'pawn.babylon'

beforeEach(() => {
  customShapeManager.set(file, btoa(JSON.stringify(pawnData)))
})

describe('createCustom()', () => {
  it('creates a custom mesh from babylon JSON data with default values, and no behavior', () => {
    const mesh = createCustom({ id: 'pawn', file })
    expect(mesh.id).toEqual('pawn')
    expect(mesh.name).toEqual('custom')
    expectDimension(mesh, [5.2982, 6.2283, 2.0563])
    expect(mesh.isPickable).toBe(false)
    expectPosition(mesh, [0, getDimensions(mesh).height * 0.5, 0])
    expect(mesh.metadata).toEqual({
      images: undefined,
      serialize: expect.any(Function)
    })
    expect(mesh.behaviors).toHaveLength(0)
  })

  it('throws on an empty JSON data', () => {
    const file = '/empty.babylon'
    customShapeManager.set(file, btoa(JSON.stringify({})))
    expect(() => createCustom({ id: 'empty-pawn', file })).toThrow(
      `${file} does not contain any mesh`
    )
  })

  it('throws on an invalid JSON data', () => {
    customShapeManager.set(file, 'invalid base64 data')
    expect(() => createCustom({ id: 'invalid-pawn', file })).toThrow(
      `Unable to load from data:;base64,invalid`
    )

    customShapeManager.set(
      file,
      btoa(JSON.stringify({ meshes: ['this is invalid'] }))
    )
    expect(() => createCustom({ id: 'invalid-pawn', file })).toThrow(
      `Unable to load from data:`
    )
  })

  it('creates a custom mesh with a single color', () => {
    const color = '#1E282F'
    const mesh = createCustom({ file, texture: color })
    expect(mesh.name).toEqual('custom')
    expectDimension(mesh, [5.2982, 6.2283, 2.0563])
    expect(mesh.material.diffuseColor).toEqual(Color4.FromHexString(color))
  })

  describe('given a card with initial position, dimension, images and behaviors', () => {
    let mesh

    const id = faker.datatype.uuid()
    const x = faker.datatype.number()
    const y = faker.datatype.number()
    const z = faker.datatype.number()

    const behaviors = {
      movable: { kind: faker.lorem.word() },
      rotable: { angle: Math.PI }
    }

    beforeEach(() => {
      mesh = createCustom({ file, id, x, y, z, ...behaviors })
    })

    it('has all the expected data', () => {
      expect(mesh.name).toEqual('custom')
      expect(mesh.id).toEqual(id)
      expectDimension(mesh, [5.2982, 6.2283, 2.0563])
      expect(mesh.isPickable).toBe(true)
      expectPosition(mesh, [x, y, z])
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
        rotate: expect.any(Function)
      })
    })

    it('unregisters custom meshes from controllables on disposal', () => {
      expect(controlManager.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(controlManager.isManaging(mesh)).toBe(false)
    })

    it('serialize with its state', () => {
      expect(mesh.metadata.serialize()).toEqual({
        shape: 'custom',
        file,
        id,
        x,
        y,
        z,
        rotable: { ...behaviors.rotable, duration: 200 },
        movable: { ...behaviors.movable, duration: 100, snapDistance: 0.25 }
      })
    })
  })
})
