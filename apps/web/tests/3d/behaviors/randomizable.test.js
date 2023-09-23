// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 */

import { RandomBehavior, RandomBehaviorName } from '@src/3d/behaviors'
import {
  createBox,
  createDie,
  getDieModelFile,
  getQuaternions
} from '@src/3d/meshes'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import die4Data from '../../../../games/assets/models/die4.obj?raw'
import die6Data from '../../../../games/assets/models/die6.obj?raw'
import die8Data from '../../../../games/assets/models/die8.obj?raw'
import { configures3dTestEngine } from '../../test-utils'

describe('RandomBehavior', () => {
  const actionRecorded = vi.fn()
  /** @type {Scene} */
  let scene
  /** @type {import('@src/3d/managers').Managers} */
  let managers

  configures3dTestEngine(
    async created => {
      scene = created.scene
      managers = created.managers
      vi.spyOn(global, 'fetch').mockImplementation(file =>
        Promise.resolve(
          new Response(
            file.toString().endsWith(getDieModelFile(8))
              ? die8Data
              : file.toString().endsWith(getDieModelFile(6))
              ? die6Data
              : die4Data
          )
        )
      )
      await managers.customShape.init({
        id: 'game',
        created: Date.now(),
        meshes: [
          { id: 'die4', shape: 'die', faces: 4, texture: '' },
          { id: 'die6', shape: 'die', faces: 6, texture: '' },
          { id: 'die8', shape: 'die', faces: 8, texture: '' }
        ]
      })
    },
    { isSimulation: globalThis.use3dSimulation }
  )

  beforeAll(() => {
    managers.control.onActionObservable.add(actionRecorded)
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has initial state', async () => {
    const state = { face: 3, quaternionPerFace: getQuaternions(6), max: 6 }
    const behavior = new RandomBehavior(state, managers)
    const mesh = createBox({ id: 'box', texture: '' }, managers, scene)

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(RandomBehaviorName)
    expect(behavior.state).toEqual(state)

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('can not build without quaternions', () => {
    // @ts-expect-error
    expect(() => new RandomBehavior({})).toThrow(
      'RandomBehavior needs quaternionPerFace'
    )
  })

  it('can not build without maximum', () => {
    expect(
      () =>
        // @ts-expect-error -- missing max property
        new RandomBehavior({ quaternionPerFace: getQuaternions(8) }, managers)
    ).toThrow(`RandomBehavior's max should be higher than 1`)
  })

  it('can not build without positive maximum', () => {
    expect(
      () =>
        new RandomBehavior(
          { max: 0, quaternionPerFace: getQuaternions(8) },
          managers
        )
    ).toThrow(`RandomBehavior's max should be higher than 1`)
  })

  it('can not restore state without mesh', () => {
    expect(() =>
      new RandomBehavior(
        {
          max: 4,
          quaternionPerFace: getQuaternions(4)
        },
        managers
      ).fromState({ face: 1 })
    ).toThrow('Can not restore state without mesh')
  })

  it('can not restore state with face higher than maximum', async () => {
    const mesh = await createBox(
      {
        id: 'box',
        texture: '',
        randomizable: { max: 4, quaternionPerFace: getQuaternions(8), face: 1 }
      },
      managers,
      scene
    )
    const behavior = getRandomizable(mesh)
    expect(() => behavior.fromState({ face: 6 })).toThrow(
      `Can not restore state face 6 since maximum is 4`
    )
  })

  it('can not random without mesh', () => {
    const face = 2
    const behavior = new RandomBehavior(
      {
        face,
        max: 4,
        quaternionPerFace: getQuaternions(4)
      },
      managers
    )
    behavior.random()
    expect(behavior.state).toMatchObject({ face })
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can not set face without mesh', () => {
    const face = 2
    const behavior = new RandomBehavior(
      {
        face,
        max: 4,
        quaternionPerFace: getQuaternions(4)
      },
      managers
    )
    behavior.setFace?.(1)
    expect(behavior.state).toMatchObject({ face })
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  describe.each([{ title: 'a 6 face die', max: 6 }])(
    'given attached to $title',
    ({ max }) => {
      /** @type {Mesh} */
      let mesh
      /** @type {RandomBehavior} */
      let behavior

      beforeEach(async () => {
        mesh = await createDie(
          {
            id: 'd6',
            texture: '',
            faces: max,
            randomizable: { canBeSet: true, duration: 150 }
          },
          managers,
          scene
        )
        behavior = getRandomizable(mesh)
      })

      it('attaches metadata to its mesh', () => {
        expect(mesh.metadata).toEqual({
          serialize: expect.any(Function),
          setFace: expect.any(Function),
          random: expect.any(Function),
          face: 1,
          maxFace: max
        })
      })

      it('can hydrate from state', async () => {
        const face = max - 1
        const canBeSet = true
        const duration = 900
        behavior.fromState({ face, canBeSet, duration })
        expect(behavior.state).toMatchObject({ face, duration })
        expect(behavior.mesh).toEqual(mesh)
        expect(mesh.metadata.face).toEqual(face)
        expect(mesh.metadata.maxFace).toEqual(max)
        expect(mesh.metadata.random).toBeDefined()
        expect(mesh.metadata.setFace).toBeDefined()
        expect(actionRecorded).not.toHaveBeenCalled()
      })

      it('can hydrate with default state', async () => {
        behavior.fromState()
        expect(behavior.state).toMatchObject({
          face: 1,
          duration: 600,
          canBeSet: false
        })
        expect(behavior.mesh).toEqual(mesh)
        expect(mesh.metadata.face).toEqual(1)
        expect(mesh.metadata.maxFace).toEqual(max)
        expect(mesh.metadata.random).toBeDefined()
        expect(mesh.metadata.setFace).toBeUndefined()
        expect(actionRecorded).not.toHaveBeenCalled()
      })

      it(`can set face`, async () => {
        await mesh.metadata.setFace?.(max)
        expect(behavior.state.face).toBe(max)
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: mesh.id,
            fn: 'setFace',
            args: [max],
            duration: 50,
            fromHand: false,
            revert: [1],
            isLocal: false
          },
          expect.anything()
        )
      })

      it(`can not set negative face`, async () => {
        await expect(mesh.metadata.setFace?.(0)).rejects.toThrow(
          `Can not set randomizable face for mesh ${mesh.id}: 0 is not in [1..${max}]`
        )
        expect(behavior.state.face).toBe(1)
        expect(actionRecorded).not.toHaveBeenCalled()
      })

      it(`can not set face higher than max`, async () => {
        await expect(mesh.metadata.setFace?.(max + 2)).rejects.toThrow(
          `Can not set randomizable face for mesh ${mesh.id}: ${
            max + 2
          } is not in [1..${max}]`
        )
        expect(behavior.state.face).toBe(1)
        expect(actionRecorded).not.toHaveBeenCalled()
      })

      it(`can randomize face`, async () => {
        await mesh.metadata.random?.()
        expect(behavior.state.face).toBeTypeOf('number')
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: mesh.id,
            fn: 'random',
            args: [expect.any(Number)],
            duration: 150,
            fromHand: false,
            revert: [1],
            isLocal: false
          },
          expect.anything()
        )
      })

      it('can revert randomized meshes', async () => {
        const face = 3
        behavior.fromState({ face })
        expect(behavior.state.face).toEqual(face)
        await mesh.metadata.random?.()
        expect(behavior.state.face).toBeTypeOf('number')
        actionRecorded.mockClear()

        await behavior.revert('random', [face])

        expect(behavior.state.face).toEqual(face)
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: mesh.id,
            fn: 'random',
            args: [face],
            duration: 600,
            fromHand: false,
            revert: [expect.any(Number)],
            isLocal: true
          },
          expect.anything()
        )
      })

      it(`can randomize face with fixed value`, async () => {
        const newFace = 2
        await mesh.metadata.random?.(newFace)
        expect(behavior.state.face).toEqual(newFace)
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: mesh.id,
            fn: 'random',
            args: [newFace],
            duration: 150,
            fromHand: false,
            revert: [1],
            isLocal: false
          },
          expect.anything()
        )
      })

      it('can revert meshes with face set', async () => {
        const face = 2
        const newFace = 3
        behavior.fromState({ face, canBeSet: true })
        expect(behavior.state.face).toEqual(face)
        await mesh.metadata.setFace?.(newFace)
        expect(behavior.state.face).toEqual(newFace)
        actionRecorded.mockClear()

        await behavior.revert('setFace', [face])

        expect(behavior.state.face).toEqual(face)
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: mesh.id,
            fn: 'setFace',
            args: [face],
            duration: 200,
            fromHand: false,
            revert: [newFace],
            isLocal: true
          },
          expect.anything()
        )
      })
    }
  )
})

function getRandomizable(/** @type {Mesh} */ mesh) {
  return /** @type {RandomBehavior} */ (
    mesh.getBehaviorByName(RandomBehaviorName)
  )
}
