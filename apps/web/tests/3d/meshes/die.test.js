// @ts-check
/**
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').PBRSpecularGlossinessMaterial} Material
 */

import { Color3 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import {
  controlManager,
  customShapeManager,
  materialManager
} from '@src/3d/managers'
import { createDie, getQuaternions } from '@src/3d/meshes'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import die4Data from '../../../../games/assets/models/die4.obj?raw'
import die6Data from '../../../../games/assets/models/die6.obj?raw'
import die8Data from '../../../../games/assets/models/die8.obj?raw'
import {
  configures3dTestEngine,
  expectDimension,
  expectPosition
} from '../../test-utils'

/** @type {Scene} */
let scene
configures3dTestEngine(created => (scene = created.scene))

beforeAll(() => materialManager.init({ scene }))

vi.mock('@src/3d/managers/custom-shape', () => ({
  customShapeManager: new Map()
}))

beforeAll(() => {
  // @ts-expect-error customShapeManager is not a map
  customShapeManager.set(`/assets/models/die4.obj`, btoa(die4Data))
  // @ts-expect-error
  customShapeManager.set(`/assets/models/die6.obj`, btoa(die6Data))
  // @ts-expect-error
  customShapeManager.set(`/assets/models/die8.obj`, btoa(die8Data))
})

describe('getQuaternions()', () => {
  it.each([{ faces: 4 }, { faces: 6 }, { faces: 8 }])(
    'returns quaternions for a $faces face die',
    ({ faces }) => {
      const quaternions = getQuaternions(faces)
      expect(quaternions.size).toBe(faces)
      for (let face = 1; face <= faces; face++) {
        expect(quaternions.get(face), `face ${face}`).toBeDefined()
      }
    }
  )

  it('throws on unsupported number of faces', () => {
    expect(() => getQuaternions(3)).toThrow('3 faces dice are not supported')
  })
})

describe('createDie()', () => {
  it('creates a 6-faces randomizable die by default', async () => {
    const id = 'd6'
    const mesh = await createDie({ id, texture: '' }, scene)
    expect(mesh.id).toEqual(id)
    expect(mesh.name).toEqual('die')
    expectDimension(mesh, [2, 2, 2])
    expect(mesh.isPickable).toBe(false)
    expectPosition(mesh, [0, 1, 0])
    expect(mesh.metadata).toEqual({
      face: 1,
      maxFace: 6,
      random: expect.any(Function),
      serialize: expect.any(Function)
    })
    expect(mesh.getBehaviorByName('randomizable')?.state).toEqual(
      expect.objectContaining({ face: 1, duration: 600, canBeSet: false })
    )
  })

  it('creates a 8-faces die with desired dimensions and position', async () => {
    const [x, y, z] = [10, -4, 3.5]
    const id = 'd8'
    const mesh = await createDie(
      { id, texture: '', faces: 8, diameter: 3, x, y, z },
      scene
    )
    expect(mesh.id).toEqual(id)
    expect(mesh.name).toEqual('die')
    expectDimension(mesh, [7.6, 6.4, 8.6])
    expect(mesh.isPickable).toBe(false)
    expectPosition(mesh, [x, y, z])
    expect(mesh.metadata).toEqual({
      face: 1,
      maxFace: 8,
      random: expect.any(Function),
      serialize: expect.any(Function)
    })
    expect(mesh.getBehaviorByName('randomizable')?.state).toEqual(
      expect.objectContaining({ face: 1, duration: 600, canBeSet: false })
    )
  })

  it('creates a 4-faces die with randomizable state and texture', async () => {
    const duration = 450
    const canBeSet = true
    const face = 2
    const id = 'd4'
    const color = '#1E282F'
    const mesh = await createDie(
      {
        id,
        faces: 4,
        texture: color,
        randomizable: { face, canBeSet, duration }
      },
      scene
    )
    expect(mesh.id).toEqual(id)
    expect(mesh.name).toEqual('die')
    expectDimension(mesh, [2.94, 2.5, 2.6])
    expect(mesh.isPickable).toBe(false)
    expectPosition(mesh, [0, 0.7, 0])
    expect(/** @type {Material} */ (mesh.material).diffuseColor).toEqual(
      Color3.FromHexString(color).toLinearSpace()
    )
    expect(mesh.metadata).toEqual({
      face,
      maxFace: 4,
      random: expect.any(Function),
      setFace: expect.any(Function),
      serialize: expect.any(Function)
    })
    expect(mesh.getBehaviorByName('randomizable')?.state).toEqual(
      expect.objectContaining({ face, duration, canBeSet })
    )
  })

  it('throws on an unsupported number of faces', async () => {
    const faces = 3
    await expect(
      createDie({ id: '', texture: '', faces }, scene)
    ).rejects.toThrow(`${faces} faces dice are not supported`)
  })

  it('creates a die with initial transformation', async () => {
    const mesh = await createDie(
      { id: '', texture: '', transform: { scaleX: 2 } },
      scene
    )
    expect(mesh.name).toEqual('die')
    expectDimension(mesh, [2, 4, 2])
  })

  describe('given a die with initial position, dimension and behaviors', () => {
    /** @type {Mesh} */
    let mesh

    const id = faker.string.uuid()
    const x = faker.number.int(999)
    const y = faker.number.int(999)
    const z = faker.number.int(999)
    const faces = 6
    const diameter = 2
    const texture = '#1E282F'

    const behaviors = {
      movable: { kind: faker.lorem.word() },
      randomizable: { face: 3 }
    }

    beforeEach(async () => {
      mesh = await createDie(
        { id, x, y, z, texture, diameter, ...behaviors },
        scene
      )
    })

    it('has all the expected data', () => {
      expect(mesh.name).toEqual('die')
      expect(mesh.id).toEqual(id)
      expect(mesh.isPickable).toBe(true)
      expectPosition(mesh, [x, y, z])
      expect(mesh.getBehaviorByName('movable')?.state).toEqual(
        expect.objectContaining(behaviors.movable)
      )
      expect(mesh.getBehaviorByName('randomizable')?.state).toEqual(
        expect.objectContaining(behaviors.randomizable)
      )
      expect(mesh.metadata).toEqual({
        ...behaviors.randomizable,
        maxFace: faces,
        serialize: expect.any(Function),
        random: expect.any(Function)
      })
    })

    it('unregisters custom meshes from controllables on disposal', () => {
      expect(controlManager.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(controlManager.isManaging(mesh)).toBe(false)
    })

    it('serialize with its state', () => {
      expect(mesh.metadata.serialize()).toEqual({
        shape: 'die',
        id,
        faces,
        diameter,
        texture,
        x,
        y,
        z,
        randomizable: {
          ...behaviors.randomizable,
          duration: 600,
          canBeSet: false
        },
        movable: { ...behaviors.movable, duration: 100, snapDistance: 0.25 }
      })
    })
  })
})
