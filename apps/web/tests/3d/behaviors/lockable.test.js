import { faker } from '@faker-js/faker'
import { configures3dTestEngine, expectMeshFeedback } from '../../test-utils'
import {
  LockBehavior,
  LockBehaviorName,
  MoveBehaviorName,
  StackBehaviorName
} from '../../../src/3d/behaviors'
import { controlManager, indicatorManager } from '../../../src/3d/managers'
import { createBox } from '../../../src/3d/meshes'

describe('LockBehavior', () => {
  const actionRecorded = jest.fn()
  let registerFeedbackSpy
  let scene

  configures3dTestEngine(created => (scene = created.scene))

  beforeAll(() => {
    controlManager.onActionObservable.add(actionRecorded)
    indicatorManager.init({ scene })
  })

  beforeEach(() => {
    jest.resetAllMocks()
    registerFeedbackSpy = jest.spyOn(indicatorManager, 'registerFeedback')
  })

  it('has initial state', () => {
    const state = {
      isLocked: faker.datatype.boolean()
    }
    const behavior = new LockBehavior(state)
    const mesh = createBox({ id: 'box' })

    expect(behavior.mesh).toBeNull()
    expect(behavior.name).toEqual(LockBehaviorName)
    expect(behavior.state).toEqual(state)

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new LockBehavior().fromState({ front: null })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can not toggle without mesh', () => {
    const behavior = new LockBehavior()
    behavior.toggleLock()
    expect(behavior.state).toEqual({ isLocked: false })
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can hydrate from state', () => {
    const isLocked = false
    const mesh = createBox({ id: 'box', lockable: {}, movable: {} })
    const behavior = getLockable(mesh)

    behavior.fromState({ isLocked })
    expect(behavior.state).toEqual({ isLocked })
    expect(behavior.mesh).toEqual(mesh)
    expect(getMovable(mesh).enabled).toBe(!isLocked)
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can hydrate with default state', () => {
    const mesh = createBox({ id: 'box', lockable: {}, movable: {} })
    const behavior = getLockable(mesh)

    behavior.fromState()
    expect(behavior.state).toEqual({ isLocked: false })
    expect(behavior.mesh).toEqual(mesh)
    expect(getMovable(mesh).enabled).toBe(true)
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  describe('given attached to mesh with no behavior', () => {
    let mesh
    let behavior
    const state = { isLocked: true }

    beforeEach(() => {
      mesh = createBox({ id: 'box', lockable: state })
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
      mesh.metadata.toggleLock()
      expect(behavior.state).toEqual({ isLocked: false })
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith(
        {
          meshId: mesh.id,
          fn: 'toggleLock',
          fromHand: false
        },
        expect.anything()
      )
      expectMeshFeedback(registerFeedbackSpy, 'unlock', mesh)
    })
  })

  describe.each([
    {
      title: 'a movable mesh',
      companionName: MoveBehaviorName,
      buildMesh: () =>
        createBox({ id: 'box', movable: {}, lockable: { isLocked: false } })
    }
  ])('given attached to $title', ({ buildMesh, companionName }) => {
    let mesh
    let behavior
    let companion

    beforeEach(() => {
      mesh = buildMesh()
      behavior = getLockable(mesh)
      companion = mesh.getBehaviorByName(companionName)
      companion.enabled = true
    })

    it(`updates the ${companionName} behavior on lock`, () => {
      mesh.metadata.toggleLock()
      expect(companion.enabled).toBe(false)
      expect(behavior.state.isLocked).toBe(true)
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenNthCalledWith(
        1,
        {
          meshId: mesh.id,
          fn: 'toggleLock',
          fromHand: false
        },
        expect.anything()
      )
      expectMeshFeedback(registerFeedbackSpy, 'lock', mesh)
      mesh.metadata.toggleLock()
      expect(companion.enabled).toBe(true)
      expect(behavior.state.isLocked).toBe(false)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(
        2,
        {
          meshId: mesh.id,
          fn: 'toggleLock',
          fromHand: false
        },
        expect.anything()
      )
      expectMeshFeedback(registerFeedbackSpy, 'unlock', mesh)
    })
  })

  describe('given attached to a movable and stackable mesh', () => {
    let meshes

    beforeEach(() => {
      meshes = Array.from({ length: 3 }, (_, rank) =>
        createBox({
          id: `box${rank + 1}`,
          stackable: {},
          movable: {},
          lockable: {}
        })
      )
    })

    it('can toggle unstacked mesh', () => {
      const [, , mesh] = meshes
      const lockable = getLockable(mesh)
      const movable = getMovable(mesh)
      mesh.metadata.toggleLock()
      expect(movable.enabled).toBe(false)
      expect(lockable.state.isLocked).toBe(true)
      expectMeshFeedback(registerFeedbackSpy, 'lock', mesh)
      mesh.metadata.toggleLock()
      expect(movable.enabled).toBe(true)
      expect(lockable.state.isLocked).toBe(false)
      expectMeshFeedback(registerFeedbackSpy, 'unlock', mesh)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
    })

    describe('given a stack', () => {
      beforeEach(() =>
        meshes[0]
          .getBehaviorByName(StackBehaviorName)
          .fromState({ stackIds: ['box2', 'box3'] })
      )

      it('does not alter movable on base mesh', () => {
        const [mesh] = meshes
        const lockable = getLockable(mesh)
        const movable = getMovable(mesh)
        expect(movable.enabled).toBe(false)
        mesh.metadata.toggleLock()
        expect(movable.enabled).toBe(false)
        expect(lockable.state.isLocked).toBe(true)
        expectMeshFeedback(registerFeedbackSpy, 'lock', mesh)
        mesh.metadata.toggleLock()
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
        mesh.metadata.toggleLock()
        expect(movable.enabled).toBe(false)
        expect(lockable.state.isLocked).toBe(true)
        expectMeshFeedback(registerFeedbackSpy, 'lock', mesh)
        mesh.metadata.toggleLock()
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
        mesh.metadata.toggleLock()
        expect(movable.enabled).toBe(false)
        expect(lockable.state.isLocked).toBe(true)
        expectMeshFeedback(registerFeedbackSpy, 'lock', mesh)
        mesh.metadata.toggleLock()
        expect(movable.enabled).toBe(true)
        expect(lockable.state.isLocked).toBe(false)
        expectMeshFeedback(registerFeedbackSpy, 'unlock', mesh)
        expect(actionRecorded).toHaveBeenCalledTimes(2)
      })
    })
  })
})

function getMovable(mesh) {
  return mesh.getBehaviorByName(MoveBehaviorName)
}

function getLockable(mesh) {
  return mesh.getBehaviorByName(LockBehaviorName)
}
