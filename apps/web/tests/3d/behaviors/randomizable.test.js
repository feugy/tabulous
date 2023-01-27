import { RandomBehavior, RandomBehaviorName } from '@src/3d/behaviors'
import { controlManager, customShapeManager } from '@src/3d/managers'
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

vi.mock('@src/3d/managers/custom-shape', () => ({
  customShapeManager: new Map()
}))

describe('RandomBehavior', () => {
  const actionRecorded = vi.fn()

  configures3dTestEngine()

  beforeAll(() => {
    controlManager.onActionObservable.add(actionRecorded)
    customShapeManager.set(getDieModelFile(4), btoa(die4Data))
    customShapeManager.set(getDieModelFile(6), btoa(die6Data))
    customShapeManager.set(getDieModelFile(8), btoa(die8Data))
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('has initial state', async () => {
    const state = { face: 3, quaternionPerFace: getQuaternions(6), max: 6 }
    const behavior = new RandomBehavior(state)
    const mesh = await createBox({ id: 'box' })

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(RandomBehaviorName)
    expect(behavior.state).toEqual(state)

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('can not build without quaternions', () => {
    expect(() => new RandomBehavior({})).toThrow(
      'RandomBehavior needs quaternionPerFace'
    )
  })

  it('can not build without maximum', () => {
    expect(
      () => new RandomBehavior({ quaternionPerFace: getQuaternions(8) })
    ).toThrow(`RandomBehavior's max should be higher than 1`)
  })

  it('can not build without positive maximum', () => {
    expect(
      () => new RandomBehavior({ max: 0, quaternionPerFace: getQuaternions(8) })
    ).toThrow(`RandomBehavior's max should be higher than 1`)
  })

  it('can not restore state without mesh', () => {
    expect(() =>
      new RandomBehavior({
        max: 4,
        quaternionPerFace: getQuaternions(4)
      }).fromState({ face: 1 })
    ).toThrow('Can not restore state without mesh')
  })

  it('can not restore state with face higher than maximum', async () => {
    const mesh = await createBox({
      id: 'box',
      randomizable: { max: 4, quaternionPerFace: getQuaternions(8), face: 1 }
    })
    const behavior = getRandomizable(mesh)
    expect(() => behavior.fromState({ face: 6 })).toThrow(
      `Can not restore state face 6 since maximum is 4`
    )
  })

  it('can not random without mesh', () => {
    const face = 2
    const behavior = new RandomBehavior({
      face,
      max: 4,
      quaternionPerFace: getQuaternions(4)
    })
    behavior.random()
    expect(behavior.state).toMatchObject({ face })
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can not set face without mesh', () => {
    const face = 2
    const behavior = new RandomBehavior({
      face,
      max: 4,
      quaternionPerFace: getQuaternions(4)
    })
    behavior.setFace(1)
    expect(behavior.state).toMatchObject({ face })
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  describe.each([{ title: 'a 6 face die', max: 6 }])(
    'given attached to $title',
    ({ max }) => {
      let mesh
      let behavior

      beforeEach(async () => {
        mesh = await createDie({
          id: 'd6',
          faces: max,
          randomizable: { canBeSet: true, duration: 150 }
        })
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
        await mesh.metadata.setFace(max)
        expect(behavior.state.face).toBe(max)
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: mesh.id,
            fn: 'setFace',
            args: [max],
            duration: 50,
            fromHand: false
          },
          expect.anything()
        )
      })

      it(`can not set negative face`, async () => {
        await expect(mesh.metadata.setFace(0)).rejects.toThrow(
          `Can not set randomizable face for mesh ${mesh.id}: 0 is not in [1..${max}]`
        )
        expect(behavior.state.face).toBe(1)
        expect(actionRecorded).not.toHaveBeenCalledTimes()
      })

      it(`can not set face higher than max`, async () => {
        await expect(mesh.metadata.setFace(max + 2)).rejects.toThrow(
          `Can not set randomizable face for mesh ${mesh.id}: ${
            max + 2
          } is not in [1..${max}]`
        )
        expect(behavior.state.face).toBe(1)
        expect(actionRecorded).not.toHaveBeenCalledTimes()
      })

      it(`can randomize face`, async () => {
        await mesh.metadata.random()
        expect(behavior.state.face).toBeTypeOf('number')
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: mesh.id,
            fn: 'random',
            args: [expect.any(Number)],
            duration: 150,
            fromHand: false
          },
          expect.anything()
        )
      })

      it(`can randomize face with fixed value`, async () => {
        const newFace = 2
        await mesh.metadata.random(newFace)
        expect(behavior.state.face).toEqual(newFace)
        expect(actionRecorded).toHaveBeenCalledOnce()
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: mesh.id,
            fn: 'random',
            args: [newFace],
            duration: 150,
            fromHand: false
          },
          expect.anything()
        )
      })
    }
  )
})

function getRandomizable(mesh) {
  return mesh.getBehaviorByName(RandomBehaviorName)
}
