// @ts-check
/**
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').PBRSpecularGlossinessMaterial} Material
 */

import { Color3 } from '@babylonjs/core/Maths/math.color'
import { faker } from '@faker-js/faker'
import { createCustom } from '@src/3d/meshes'
import { getDimensions } from '@src/3d/utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import pawnData from '../../fixtures/pawn.obj?raw'
import {
  configures3dTestEngine,
  expectDimension,
  expectPosition
} from '../../test-utils'

/** @type {Scene} */
let scene
/** @type {import('@src/3d/managers').Managers} */
let managers
const file = 'pawn.obj'
const empty = 'empty.obj'
const pawnDimensions = [1.11, 2.45, 0.84]

configures3dTestEngine(async created => {
  scene = created.scene
  managers = created.managers
  vi.spyOn(global, 'fetch').mockImplementation(file =>
    Promise.resolve(
      new Response(file.toString().endsWith(empty) ? '' : pawnData)
    )
  )
  await managers.customShape.init({
    id: 'game',
    created: Date.now(),
    meshes: [
      { id: 'pawn', shape: 'custom', file, texture: '' },
      { id: 'empty', shape: 'custom', file: empty, texture: '' }
    ]
  })
})

describe('createCustom()', () => {
  it('creates a custom mesh from OBJ data with default values, and no behavior', async () => {
    const mesh = await createCustom(
      { id: 'pawn', texture: '', file },
      managers,
      scene
    )
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

  it('creates a custom mesh with initial transformation', async () => {
    const mesh = await createCustom(
      {
        id: '',
        texture: '',
        file,
        transform: { scaleX: 2, scaleY: 2, scaleZ: 2 }
      },
      managers,
      scene
    )
    expect(mesh.name).toEqual('custom')
    expectDimension(
      mesh,
      pawnDimensions.map(n => n * 2)
    )
  })

  it('throws on an empty data', async () => {
    await expect(
      createCustom({ id: '', texture: '', file: empty }, managers, scene)
    ).rejects.toThrow(`${empty} does not contain any mesh`)
  })

  it('creates a custom mesh with a single color', async () => {
    const color = '#1E282F'
    const mesh = await createCustom(
      { id: '', file, texture: color },
      managers,
      scene
    )
    expect(mesh.name).toEqual('custom')
    expectDimension(mesh, pawnDimensions)
    expect(/** @type {Material} */ (mesh.material).diffuseColor).toEqual(
      Color3.FromHexString(color).toLinearSpace()
    )
  })

  describe('given a mesh with initial position, dimension, images and behaviors', () => {
    /** @type {Mesh} */
    let mesh

    const id = faker.string.uuid()
    const x = faker.number.int(999)
    const y = faker.number.int(999)
    const z = faker.number.int(999)
    const texture = faker.color.rgb()

    const behaviors = {
      movable: { kind: faker.lorem.word() },
      rotable: { angle: Math.PI }
    }

    beforeEach(async () => {
      mesh = await createCustom(
        { file, id, texture, x, y, z, ...behaviors },
        managers,
        scene
      )
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
        angle: behaviors.rotable.angle,
        serialize: expect.any(Function),
        rotate: expect.any(Function)
      })
    })

    it('unregisters custom meshes from controllables on disposal', () => {
      expect(managers.control.isManaging(mesh)).toBe(true)
      mesh.dispose()
      expect(managers.control.isManaging(mesh)).toBe(false)
    })

    it('serialize with its state', () => {
      expect(mesh.metadata.serialize()).toEqual({
        shape: 'custom',
        file,
        id,
        texture,
        x,
        y,
        z,
        rotable: { ...behaviors.rotable, duration: 200 },
        movable: { ...behaviors.movable, duration: 100, snapDistance: 0.25 }
      })
    })
  })
})
