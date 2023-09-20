// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/behaviors').MoveBehavior} MoveBehavior
 * @typedef {import('@src/3d/utils').BehaviorNames} BehaviorNames
 */
/**
 * @template {any[]} P, R
 * @typedef {import('vitest').SpyInstance<P, R>} SpyInstance
 */

import { faker } from '@faker-js/faker'
import {
  LockBehavior,
  LockBehaviorName,
  MoveBehaviorName,
  StackBehaviorName
} from '@src/3d/behaviors'
import { createBox } from '@src/3d/meshes'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { configures3dTestEngine, expectMeshFeedback } from '../../test-utils'

describe('LockBehavior', () => {
  const actionRecorded = vi.fn()

  /** @type {SpyInstance<Parameters<import('@src/3d/managers').IndicatorManager['registerFeedback']>, void>} */
  let registerFeedbackSpy
  /** @type {Scene} */
  let scene
  /** @type {import('@src/3d/managers').Managers} */
  let managers

  configures3dTestEngine(created => {
    scene = created.scene
    managers = created.managers
  })

  beforeAll(() => {
    managers.control.onActionObservable.add(actionRecorded)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    registerFeedbackSpy = vi.spyOn(managers.indicator, 'registerFeedback')
  })

  it('has initial state', () => {
    const state = {
      isLocked: faker.datatype.boolean()
    }
    const behavior = new LockBehavior(state, managers)
    const mesh = createBox({ id: 'box', texture: '' }, managers, scene)

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(LockBehaviorName)
    expect(behavior.state).toEqual(state)

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new LockBehavior({}, managers).fromState({})).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can not toggle without mesh', () => {
    const behavior = new LockBehavior({}, managers)
    behavior.toggleLock?.()
    expect(behavior.state).toEqual({ isLocked: false })
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can hydrate from state', () => {
    const isLocked = false
    const mesh = createBox(
      { id: 'box', texture: '', lockable: {}, movable: {} },
      managers,
      scene
    )
    const behavior = getLockable(mesh)

    behavior.fromState({ isLocked })
    expect(behavior.state).toEqual({ isLocked })
    expect(behavior.mesh).toEqual(mesh)
    expect(getMovable(mesh).enabled).toBe(!isLocked)
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const mesh = createBox(
      { id: 'box', texture: '', lockable: {}, movable: {} },
      managers,
      scene
    )
    const behavior = getLockable(mesh)

    behavior.fromState()
    expect(behavior.state).toEqual({ isLocked: false })
    expect(behavior.mesh).toEqual(mesh)
    expect(getMovable(mesh).enabled).toBe(true)
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  describe('given attached to mesh with no behavior', () => {
    /** @type {Mesh} */
    let mesh
    /** @type {LockBehavior} */
    let behavior
    const state = { isLocked: true }

    beforeEach(() => {
      mesh = createBox(
        { id: 'box', texture: '', lockable: state },
        managers,
        scene
      )
      behavior = getLockable(mesh)
    })

    it('attaches metadata to its mesh', () => {
      expect(mesh.metadata).toEqual({
        serialize: expect.any(Function),
        toggleLock: expect.any(Function),
        isLocked: true
      })
    })

    it(`can toggle without companion behaviors`, () => {
      mesh.metadata.toggleLock?.()
      expect(behavior.state).toEqual({ isLocked: false })
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: mesh.id,
          fn: 'toggleLock',
          args: [],
          fromHand: false,
          isLocal: false
        },
        expect.anything()
      )
      expectMeshFeedback(registerFeedbackSpy, 'unlock', mesh)
    })

    it('can revert toggle lock mesh', async () => {
      mesh.metadata.toggleLock?.()
      expect(behavior.state).toEqual({ isLocked: false })
      actionRecorded.mockClear()
      registerFeedbackSpy.mockClear()
      const expectedRecord = {
        meshId: mesh.id,
        fn: 'toggleLock',
        args: [],
        fromHand: false,
        isLocal: true
      }

      await behavior.revert('toggleLock')
      expect(behavior.state).toEqual({ isLocked: true })
      expectMeshFeedback(registerFeedbackSpy, 'lock', mesh)

      await behavior.revert('toggleLock')
      expect(behavior.state).toEqual({ isLocked: false })
      expectMeshFeedback(registerFeedbackSpy, 'unlock', mesh)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(
        1,
        expectedRecord,
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenNthCalledWith(
        2,
        expectedRecord,
        expect.anything()
      )
    })
  })

  describe.each([
    {
      title: 'a movable mesh',
      companionName: MoveBehaviorName,
      buildMesh: () =>
        createBox(
          {
            id: 'box',
            texture: '',
            movable: {},
            lockable: { isLocked: false }
          },
          managers,
          scene
        )
    }
  ])('given attached to $title', ({ buildMesh, companionName }) => {
    /** @type {Mesh} */
    let mesh
    /** @type {LockBehavior} */
    let behavior
    /** @type {MoveBehavior} */
    let companion

    beforeEach(() => {
      mesh = buildMesh()
      behavior = getLockable(mesh)
      // @ts-expect-error companionName is not a behavior name
      companion = mesh.getBehaviorByName(companionName)
      companion.enabled = true
    })

    it(`updates the ${companionName} behavior on lock`, () => {
      const expectedRecord = {
        meshId: mesh.id,
        fn: 'toggleLock',
        args: [],
        fromHand: false,
        isLocal: false
      }
      mesh.metadata.toggleLock?.()
      expect(companion.enabled).toBe(false)
      expect(behavior.state.isLocked).toBe(true)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenNthCalledWith(
        1,
        expectedRecord,
        expect.anything()
      )
      expectMeshFeedback(registerFeedbackSpy, 'lock', mesh)
      mesh.metadata.toggleLock?.()
      expect(companion.enabled).toBe(true)
      expect(behavior.state.isLocked).toBe(false)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(
        2,
        expectedRecord,
        expect.anything()
      )
      expectMeshFeedback(registerFeedbackSpy, 'unlock', mesh)
    })
  })

  describe('given attached to a movable and stackable mesh', () => {
    /** @type {Mesh[]} */
    let meshes

    beforeEach(() => {
      meshes = Array.from({ length: 3 }, (_, rank) =>
        createBox(
          {
            id: `box${rank + 1}`,
            texture: '',
            stackable: {},
            movable: {},
            lockable: {}
          },
          managers,
          scene
        )
      )
    })

    it('can toggle unstacked mesh', () => {
      const [, , mesh] = meshes
      const lockable = getLockable(mesh)
      const movable = getMovable(mesh)
      mesh.metadata.toggleLock?.()
      expect(movable.enabled).toBe(false)
      expect(lockable.state.isLocked).toBe(true)
      expectMeshFeedback(registerFeedbackSpy, 'lock', mesh)
      mesh.metadata.toggleLock?.()
      expect(movable.enabled).toBe(true)
      expect(lockable.state.isLocked).toBe(false)
      expectMeshFeedback(registerFeedbackSpy, 'unlock', mesh)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
    })

    describe('given a stack', () => {
      beforeEach(() =>
        meshes[0]
          .getBehaviorByName(StackBehaviorName)
          ?.fromState({ stackIds: ['box2', 'box3'] })
      )

      it('does not alter movable on base mesh', () => {
        const [mesh] = meshes
        const lockable = getLockable(mesh)
        const movable = getMovable(mesh)
        expect(movable.enabled).toBe(false)
        mesh.metadata.toggleLock?.()
        expect(movable.enabled).toBe(false)
        expect(lockable.state.isLocked).toBe(true)
        expectMeshFeedback(registerFeedbackSpy, 'lock', mesh)
        mesh.metadata.toggleLock?.()
        expect(movable.enabled).toBe(false)
        expect(lockable.state.isLocked).toBe(false)
        expectMeshFeedback(registerFeedbackSpy, 'unlock', mesh)
        expect(actionRecorded).toHaveBeenCalledTimes(2)
      })

      it('does not alter movable on intermediate mesh', () => {
        const [, mesh] = meshes
        const lockable = getLockable(mesh)
        const movable = getMovable(mesh)
        expect(movable.enabled).toBe(false)
        mesh.metadata.toggleLock?.()
        expect(movable.enabled).toBe(false)
        expect(lockable.state.isLocked).toBe(true)
        expectMeshFeedback(registerFeedbackSpy, 'lock', mesh)
        mesh.metadata.toggleLock?.()
        expect(movable.enabled).toBe(false)
        expect(lockable.state.isLocked).toBe(false)
        expectMeshFeedback(registerFeedbackSpy, 'unlock', mesh)
        expect(actionRecorded).toHaveBeenCalledTimes(2)
      })

      it('can toggle the last stacked mesh', () => {
        const [, , mesh] = meshes
        const lockable = getLockable(mesh)
        const movable = getMovable(mesh)
        expect(movable.enabled).toBe(true)
        mesh.metadata.toggleLock?.()
        expect(movable.enabled).toBe(false)
        expect(lockable.state.isLocked).toBe(true)
        expectMeshFeedback(registerFeedbackSpy, 'lock', mesh)
        mesh.metadata.toggleLock?.()
        expect(movable.enabled).toBe(true)
        expect(lockable.state.isLocked).toBe(false)
        expectMeshFeedback(registerFeedbackSpy, 'unlock', mesh)
        expect(actionRecorded).toHaveBeenCalledTimes(2)
      })
    })
  })
})

function getMovable(/** @type {Mesh} */ mesh) {
  return /** @type {MoveBehavior} */ (mesh.getBehaviorByName(MoveBehaviorName))
}

function getLockable(/** @type {Mesh} */ mesh) {
  return /** @type {LockBehavior} */ (mesh.getBehaviorByName(LockBehaviorName))
}
