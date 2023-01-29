import { Color4 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import {
  controlManager,
  customShapeManager,
  materialManager
} from '@src/3d/managers'
import { createCustom } from '@src/3d/meshes'
import { getDimensions } from '@src/3d/utils'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import pawnData from '../../fixtures/pawn.obj?raw'
import {
  configures3dTestEngine,
  expectDimension,
  expectPosition
} from '../../test-utils'

let scene
configures3dTestEngine(created => (scene = created.scene))

beforeAll(() => materialManager.init({ scene }))

vi.mock('@src/3d/managers/custom-shape', () => ({
  customShapeManager: new Map()
}))

const file = 'pawn.obj'
const pawnDimensions = [1.11, 2.45, 0.84]

beforeEach(() => {
  customShapeManager.set(file, btoa(pawnData))
})

describe('createCustom()', () => {
  it('creates a custom mesh from OBJ data with default values, and no behavior', async () => {
    const mesh = await createCustom({ id: 'pawn', file })
    expect(mesh.id).toEqual('pawn')
    expect(mesh.name).toEqual('custom')
    expectDimension(mesh, pawnDimensions)
    expect(mesh.isPickable).toBe(false)
    expectPosition(mesh, [0, getDimensions(mesh).height * 0.5, 0])
    expect(mesh.metadata).toEqual({
      images: undefined,
      serialize: expect.any(Function)
    })
    expect(mesh.behaviors).toHaveLength(0)
  })

  it('throws on an empty data', async () => {
    const file = '/empty.obj'
    customShapeManager.set(file, btoa(JSON.stringify({})))
    await expect(createCustom({ id: 'empty-pawn', file })).rejects.toThrow(
      `${file} does not contain any mesh`
    )
  })

  it('throws on an invalid data', async () => {
    customShapeManager.set(file, 'invalid base64 data')
    await expect(createCustom({ id: 'invalid-pawn', file })).rejects.toThrow(
      `Unable to load from pawn.obj: InvalidCharacterError: The string to be decoded contains invalid characters.`
    )
  })

  it('throws on mesh-less data', async () => {
    customShapeManager.set(file, btoa('this is invalid'))
    await expect(createCustom({ id: 'invalid-pawn', file })).rejects.toThrow(
      `${file} does not contain any mesh`
    )
  })

  it('creates a custom mesh with a single color', async () => {
    const color = '#1E282F'
    const mesh = await createCustom({ file, texture: color })
    expect(mesh.name).toEqual('custom')
    expectDimension(mesh, pawnDimensions)
    expect(mesh.material.diffuseColor).toEqual(Color4.FromHexString(color))
  })

  describe('given a mesh with initial position, dimension, images and behaviors', () => {
    let mesh

    const id = faker.datatype.uuid()
    const x = faker.datatype.number()
    const y = faker.datatype.number()
    const z = faker.datatype.number()

    const behaviors = {
      movable: { kind: faker.lorem.word() },
      rotable: { angle: Math.PI }
    }

    beforeEach(async () => {
      mesh = await createCustom({ file, id, x, y, z, ...behaviors })
    })

    it('has all the expected data', () => {
      expect(mesh.name).toEqual('custom')
      expect(mesh.id).toEqual(id)
      expectDimension(mesh, pawnDimensions)
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
