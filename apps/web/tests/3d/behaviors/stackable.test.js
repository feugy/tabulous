// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Observer<?>} Observer
 * @typedef {import('@babylonjs/core').Scene} Scene
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import {
  AnchorBehavior,
  AnchorBehaviorName,
  DrawBehavior,
  FlipBehavior,
  FlipBehaviorName,
  LockBehavior,
  MoveBehavior,
  MoveBehaviorName,
  RotateBehavior,
  RotateBehaviorName,
  StackBehaviorName
} from '@src/3d/behaviors'
import { StackBehavior } from '@src/3d/behaviors/stackable'
import { getAnimatableBehavior, getTargetableBehavior } from '@src/3d/utils'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  createCylinder,
  expectAnimationEnd,
  expectFlipped,
  expectInteractible,
  expectMeshFeedback,
  expectMoveRecorded,
  expectPosition,
  expectRotated,
  expectSnapped,
  expectStacked,
  expectStackIndicator,
  expectZone,
  sleep
} from '../../test-utils'

describe('StackBehavior', () => {
  configures3dTestEngine(created => (managers = created.managers), {
    isSimulation: globalThis.use3dSimulation
  })

  const actionRecorded = vi.fn()
  const moveRecorded = vi.fn()
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  /** @type {import('vitest').Spy<import('@src/3d/managers').IndicatorManager['registerFeedback']>} */
  let registerFeedbackSpy
  /** @type {?Observer} */
  let moveObserver

  beforeAll(() => {
    moveObserver = managers.move.onMoveObservable.add(moveRecorded)
    managers.control.onActionObservable.add(data => actionRecorded(data))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    registerFeedbackSpy = vi.spyOn(managers.indicator, 'registerFeedback')
    vi.spyOn(managers.hand, 'draw').mockImplementation(async mesh => {
      managers.control.record({ mesh, fn: 'draw', args: [] })
    })
  })

  afterAll(() => {
    managers.move.onMoveObservable.remove(moveObserver)
  })

  it('has initial state', () => {
    const state = {
      extent: faker.number.int(999),
      duration: faker.number.int(999),
      kinds: [],
      stackIds: [],
      angle: faker.number.int(999)
    }
    const behavior = new StackBehavior(state, managers)

    expect(behavior.name).toEqual(StackBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.stack).toEqual([])
    expect(behavior.base).toBeNull()
    expect(behavior.inhibitControl).toBe(false)
    expect(behavior.mesh).toBeNull()
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() =>
      new StackBehavior({}, managers).fromState({ duration: 100 })
    ).toThrow('Can not restore state without mesh')
  })

  it('can hydrate with default state', () => {
    const behavior = new StackBehavior({}, managers)
    const mesh = createBox('box0', {})
    mesh.addBehavior(behavior, true)

    behavior.fromState()
    expect(behavior.state).toEqual({
      extent: 2,
      duration: 100,
      stackIds: [],
      angle: undefined
    })
    expect(behavior.mesh).toEqual(mesh)
    expect(mesh.metadata.stack).toEqual([mesh])
    expectStackIndicator(managers, mesh)
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can hydrate with stacked mesh', () => {
    const stacked = createBox('box1', {})
    stacked.addBehavior(new StackBehavior({}, managers), true)

    const mesh = createBox('box0', {})
    mesh.addBehavior(
      new StackBehavior({ stackIds: [stacked.id] }, managers),
      true
    )
    expectStacked(managers, [mesh, stacked])
    expectMoveRecorded(moveRecorded)
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not push mesh', () => {
    expect(new StackBehavior({}, managers).canPush(createBox('box1', {}))).toBe(
      false
    )
  })

  describe('given attached to a mesh', () => {
    /** @type {Mesh} */
    let mesh
    /** @type {Mesh} */
    let box1
    /** @type {Mesh} */
    let box2
    /** @type {Mesh} */
    let box3
    /** @type {StackBehavior} */
    let behavior

    beforeEach(() => {
      ;[mesh, box1, box2, box3] = Array.from({ length: 4 }, (_, rank) => {
        const id = `box${rank}`
        const box = createBox(id, {})
        box.setAbsolutePosition(new Vector3(rank, rank, rank))
        box.addBehavior(new StackBehavior({ duration: 10 }, managers), true)
        box.addBehavior(new FlipBehavior({ duration: 100 }, managers), true)
        box.addBehavior(new RotateBehavior({ duration: 100 }, managers), true)
        box.addBehavior(new MoveBehavior({}, managers), true)
        box.addBehavior(
          new AnchorBehavior(
            {
              anchors: [
                { id: `${id}-1`, x: -0.5 },
                { id: `${id}-2`, x: 0.5 }
              ]
            },
            managers
          )
        )
        box.addBehavior(new DrawBehavior({}, managers), true)
        managers.control.registerControlable(box)
        return box
      })

      behavior = /** @type {StackBehavior} */ (getTargetableBehavior(mesh))
    })

    it('attaches metadata to its mesh', () => {
      expectZone(behavior, {
        extent: 2,
        enabled: true,
        ignoreParts: true
      })
      expectStacked(managers, [mesh])
      expect(behavior.state.duration).toEqual(10)
      expect(behavior.state.extent).toEqual(2)
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          push: expect.any(Function),
          pop: expect.any(Function),
          reorder: expect.any(Function),
          flipAll: expect.any(Function),
          canPush: expect.any(Function)
        })
      )
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can hydrate from state', async () => {
      const extent = faker.number.int(999)
      const stackIds = [box1.id, box3.id]
      const duration = faker.number.int(999)
      const kinds = ['card']
      const priority = faker.number.int(999)
      expect(box1.absolutePosition).toEqual(Vector3.FromArray([1, 1, 1]))
      expect(box3.absolutePosition).toEqual(Vector3.FromArray([3, 3, 3]))

      behavior.fromState({ duration, extent, stackIds, kinds, priority })
      expectZone(behavior, {
        extent,
        enabled: false,
        kinds,
        priority,
        ignoreParts: true
      })
      expectStacked(managers, [mesh, box1, box3])
      expect(behavior.state.duration).toEqual(duration)
      expect(behavior.state.extent).toEqual(extent)
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          push: expect.any(Function),
          pop: expect.any(Function),
          reorder: expect.any(Function),
          flipAll: expect.any(Function),
          canPush: expect.any(Function)
        })
      )
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can hydrate with cylindric zone', async () => {
      const extent = faker.number.int(999)
      const stackIds = [box1.id, box3.id]
      const duration = faker.number.int(999)
      const kinds = ['tokens']
      const priority = faker.number.int(999)
      const diameter = 5
      expect(box1.absolutePosition).toEqual(Vector3.FromArray([1, 1, 1]))
      expect(box3.absolutePosition).toEqual(Vector3.FromArray([3, 3, 3]))
      mesh.removeBehavior(behavior)
      mesh = createCylinder('roundToken', { diameter })
      mesh.addBehavior(behavior, true)

      behavior.fromState({ duration, extent, stackIds, kinds, priority })
      expectZone(behavior, {
        extent,
        enabled: false,
        kinds,
        priority,
        ignoreParts: true
      })
      const { boundingBox } = behavior.zones[0].mesh.getBoundingInfo()
      expect(boundingBox.extendSize.x * 2).toBeCloseTo(diameter)
      expect(boundingBox.extendSize.z * 2).toBeCloseTo(diameter)
      expectStacked(managers, [mesh, box1, box3])
      expect(behavior.state.duration).toEqual(duration)
      expect(behavior.state.extent).toEqual(extent)
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          push: expect.any(Function),
          pop: expect.any(Function),
          reorder: expect.any(Function),
          flipAll: expect.any(Function),
          canPush: expect.any(Function)
        })
      )
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can hydrate with its own state', () => {
      behavior.fromState({ stackIds: ['box2', 'box1'] })
      expectStacked(managers, [mesh, box2, box1])

      behavior.fromState({ stackIds: ['box2', 'box1'] })
      expectStacked(managers, [mesh, box2, box1])
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can rotate mesh when hydrating from state', async () => {
      const baseAngle = Math.PI * 0.5
      const stackIds = [box1.id, box3.id]
      box3
        .getBehaviorByName(RotateBehaviorName)
        ?.fromState({ duration: 100, angle: baseAngle })
      expectRotated(box3, baseAngle)

      behavior.fromState({ stackIds, angle: 0 })
      expectRotated(box3, 0)
      expectZone(behavior, { extent: 2, enabled: false, ignoreParts: true })
      expectStacked(managers, [mesh, box1, box3])
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('rotates pushed mesh regardless of their parent when hydrating', async () => {
      const angle = Math.PI * 0.5
      await mesh.getBehaviorByName(RotateBehaviorName)?.rotate()
      behavior.fromState({ stackIds: [], angle: 0 })
      expectStacked(managers, [mesh])
      expectRotated(mesh, angle)
      expectRotated(box1, 0)
      await mesh.metadata.push?.(box1.id)
      await mesh.metadata.push?.(box3.id)
      expectStacked(managers, [mesh, box1, box3])
      expectRotated(mesh, angle)
      expectRotated(box1, angle)
      expectRotated(box3, angle)

      behavior.fromState({ stackIds: [box1.id, box3.id], angle: 0 })
      expectStacked(managers, [mesh, box1, box3])
      expectRotated(mesh, angle)
      expectRotated(box1, angle)
      expectRotated(box3, angle)
    })

    it('does not enable locked meshes when hydrating', async () => {
      const extent = faker.number.int(999)
      const stackIds = [box1.id, box3.id]
      const duration = faker.number.int(999)
      const kinds = ['card']
      const priority = faker.number.int(999)
      expect(box1.absolutePosition).toEqual(Vector3.FromArray([1, 1, 1]))
      expect(box3.absolutePosition).toEqual(Vector3.FromArray([3, 3, 3]))
      mesh.addBehavior(new LockBehavior({ isLocked: true }, managers), true)
      box1.addBehavior(new LockBehavior({ isLocked: true }, managers), true)
      box3.addBehavior(new LockBehavior({ isLocked: true }, managers), true)

      behavior.fromState({ duration, extent, stackIds, kinds, priority })
      expectZone(behavior, {
        extent,
        enabled: false,
        kinds,
        priority,
        ignoreParts: true
      })
      expectStacked(managers, [mesh, box1, box3], false)
      expect(behavior.state.duration).toEqual(duration)
      expect(behavior.state.extent).toEqual(extent)
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          push: expect.any(Function),
          pop: expect.any(Function),
          reorder: expect.any(Function),
          flipAll: expect.any(Function),
          canPush: expect.any(Function)
        })
      )
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('pushes new mesh on stack', async () => {
      expectStacked(managers, [mesh])
      const position = [1, 1, 1]
      expect(box1.absolutePosition).toEqual(Vector3.FromArray(position))

      await mesh.metadata.push?.(box1.id)
      expectStacked(managers, [mesh, box1])
      expectRotated(box1, 0)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'push',
        meshId: mesh.id,
        args: [box1.id, false],
        duration: behavior.state.duration,
        revert: [1, false, position, 0],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded, box1)
      expectMeshFeedback(registerFeedbackSpy, 'push', box1)
    })

    it('can push on any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1'] })

      await box2.metadata.push?.(box3.id)
      expectStacked(managers, [mesh, box2, box1, box3])
      expectRotated(box1, 0)
      expectRotated(box2, 0)
      expectRotated(box3, 0)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'push',
        meshId: mesh.id,
        args: [box3.id, false],
        duration: box2.getBehaviorByName(StackBehaviorName)?.state.duration,
        revert: [1, false, [3, 3, 3], 0],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded, box3)
      expectMeshFeedback(registerFeedbackSpy, 'push', box3)
    })

    it('can rotate mesh when pushing them', async () => {
      const baseAngle = Math.PI * 0.5
      mesh
        .getBehaviorByName(RotateBehaviorName)
        ?.fromState({ duration: 100, angle: baseAngle })
      expectRotated(mesh, baseAngle)
      const angle = Math.PI
      const initialAngle = Math.PI * -0.5
      box1
        .getBehaviorByName(RotateBehaviorName)
        ?.fromState({ duration: 100, angle: initialAngle })
      box1
        .getBehaviorByName(FlipBehaviorName)
        ?.fromState({ duration: 100, isFlipped: true })
      behavior.fromState({ angle })
      expectStacked(managers, [mesh])
      expect(box1.absolutePosition).toEqual(Vector3.FromArray([1, 1, 1]))

      await mesh.metadata.push?.(box1.id)
      expectRotated(box1, baseAngle - angle)
      expectFlipped(box1)
      expectStacked(managers, [mesh, box1])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'push',
        meshId: mesh.id,
        args: [box1.id, false],
        duration: behavior.state.duration,
        revert: [1, false, [1, 1, 1], expect.numberCloseTo(initialAngle)],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded, box1)
      expectMeshFeedback(registerFeedbackSpy, 'push', box1)
    })

    it('does not enable locked mesh when pushing', async () => {
      box1.addBehavior(new LockBehavior({ isLocked: true }, managers), true)
      expectStacked(managers, [mesh])
      expectInteractible(mesh, true)
      expectInteractible(box1, true, false)

      await mesh.metadata.push?.(box1.id)
      expectStacked(managers, [mesh, box1], false)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'push',
        meshId: mesh.id,
        args: [box1.id, false],
        duration: behavior.state.duration,
        revert: [1, false, [1, 1, 1], 0],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded, box1)
      expectMeshFeedback(registerFeedbackSpy, 'push', box1)
    })

    it('pushes dropped meshes', async () => {
      behavior.fromState({ stackIds: ['box2'] })
      const targetable = /** @type {StackBehavior} */ (
        getTargetableBehavior(box2)
      )
      const isLocal = true

      targetable.onDropObservable.notifyObservers({
        dropped: [box1, box3],
        isLocal,
        zone: targetable.zones[0]
      })
      await sleep(behavior.state.duration)
      expectStacked(managers, [mesh, box2, box1, box3])
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'push',
        meshId: mesh.id,
        args: [box1.id, false],
        duration: box2.getBehaviorByName(StackBehaviorName)?.state.duration,
        revert: [1, false, [1, 1, 1], 0],
        fromHand: false,
        isLocal
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'push',
        meshId: mesh.id,
        args: [box3.id, false],
        duration: box2.getBehaviorByName(StackBehaviorName)?.state.duration,
        revert: [1, false, [3, 3, 3], 0],
        fromHand: false,
        isLocal
      })
      expectMoveRecorded(moveRecorded, box1, box3)
      expectMeshFeedback(registerFeedbackSpy, 'push', box1, box3)
    })

    it('pushes a stack of meshes on stack', async () => {
      behavior.fromState({ stackIds: ['box1'] })
      expectStacked(managers, [mesh, box1])

      box2
        .getBehaviorByName(StackBehaviorName)
        ?.fromState({ stackIds: ['box3'] })
      expectStacked(managers, [box2, box3])

      await mesh.metadata.push?.(box2.id)
      expectStacked(managers, [mesh, box1, box2, box3])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'push',
        meshId: mesh.id,
        args: [box2.id, false],
        duration: behavior.state.duration,
        revert: [1, false, [2, 2, 2], 0],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded, box2)
      expectMeshFeedback(registerFeedbackSpy, 'push', box2)
    })

    it('can revert a single pushed mesh', async () => {
      const position = [2, 2, 2]
      const angle = Math.PI * 0.5
      behavior.fromState({ stackIds: ['box1', 'box2'] })
      expectStacked(managers, [mesh, box1, box2])
      expectRotated(mesh, 0)
      expectPosition(mesh, [0, 0, 0])
      registerFeedbackSpy.mockClear()
      actionRecorded.mockClear()

      await behavior.revert('push', [1, false, position, angle])
      expectStacked(managers, [mesh, box1])
      expectRotated(mesh, 0)
      expectStacked(managers, [box2])
      expectRotated(box2, angle)
      expectPosition(box2, position)
      expect(registerFeedbackSpy).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id,
        args: [1, false],
        revert: [[box2.id], false],
        fromHand: false,
        isLocal: true
      })
    })

    it('can revert a stack of pushed mesh', async () => {
      const position = [3, 3, 3]
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      expectStacked(managers, [mesh, box1, box2, box3])
      expectRotated(mesh, 0)
      expectPosition(mesh, [0, 0, 0])
      registerFeedbackSpy.mockClear()
      actionRecorded.mockClear()

      await behavior.revert('push', [2, false, position, undefined])
      expectStacked(managers, [mesh, box1])
      expectRotated(mesh, 0)
      expectStacked(managers, [box2, box3])
      expectRotated(box2, 0)
      expectPosition(box2, position)
      expect(registerFeedbackSpy).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id,
        args: [2, false],
        revert: [[box2.id, box3.id], false],
        fromHand: false,
        isLocal: true
      })
    })

    it('can immediately revert pushed mesh', async () => {
      const position = [1, 1, 1]
      behavior.fromState({ stackIds: ['box1'] })
      expectStacked(managers, [mesh, box1])
      expectRotated(mesh, 0)
      expectPosition(mesh, [0, 0, 0])
      registerFeedbackSpy.mockClear()
      actionRecorded.mockClear()

      await behavior.revert('push', [1, true, position, undefined])
      expectStacked(managers, [mesh])
      expectRotated(mesh, 0)
      expectStacked(managers, [box1])
      expectRotated(box1, 0)
      expectPosition(box1, position)
      expect(registerFeedbackSpy).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id,
        args: [1, true],
        duration: behavior.state.duration,
        revert: [[box1.id], true],
        fromHand: false,
        isLocal: true
      })
    })

    it('can not pop an empty stack', async () => {
      expect(await mesh.metadata.pop?.()).toEqual([])
      expectStacked(managers, [mesh])
      expect(actionRecorded).not.toHaveBeenCalled()
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('pops last mesh from stack', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      let [poped] = (await mesh.metadata.pop?.()) ?? []
      expect(poped?.id).toBe('box3')
      expectInteractible(poped)
      expect(poped.parent?.id).toBeUndefined()
      expectStacked(managers, [mesh, box2, box1])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id,
        args: [1, false],
        revert: [[poped?.id], false],
        fromHand: false,
        isLocal: false
      })
      expectStackIndicator(managers, poped)
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
      ;[poped] = (await mesh.metadata.pop?.()) ?? []
      expect(poped?.id).toBe('box1')
      expectInteractible(poped)
      expect(poped.parent?.id).toBeUndefined()
      expectStacked(managers, [mesh, box2])
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'pop',
        meshId: mesh.id,
        args: [1, false],
        revert: [[poped?.id], false],
        fromHand: false,
        isLocal: false
      })
      expectStackIndicator(managers, poped)
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
      ;[poped] = (await mesh.metadata.pop?.()) ?? []
      expect(poped?.id).toBe('box2')
      expectInteractible(poped)
      expect(poped.parent?.id).toBeUndefined()
      expectStacked(managers, [mesh])
      expect(actionRecorded).toHaveBeenCalledTimes(3)
      expect(actionRecorded).toHaveBeenNthCalledWith(3, {
        fn: 'pop',
        meshId: mesh.id,
        args: [1, false],
        revert: [[poped?.id], false],
        fromHand: false,
        isLocal: false
      })
      expectStackIndicator(managers, poped)
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
      expectMoveRecorded(moveRecorded)
    })

    it('pops and moves a single mesh from stack', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      const [[poped]] = await Promise.all([
        mesh.metadata.pop ? mesh.metadata.pop(1, true) : [],
        expectAnimationEnd(getAnimatableBehavior(box3))
      ])
      expect(poped?.id).toBe('box3')
      expect(poped.parent?.id).toBeUndefined()
      expectInteractible(poped)
      expectStacked(managers, [mesh, box2, box1])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id,
        args: [1, true],
        duration: behavior.state.duration,
        revert: [[poped?.id], true],
        fromHand: false,
        isLocal: false
      })
      expectPosition(poped, [1.25, 0.5, 0])
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
      expectMoveRecorded(moveRecorded)
    })

    it('pops and moves multiple meshes from stack', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      const [[poped1, poped2]] = await Promise.all([
        mesh.metadata.pop ? mesh.metadata.pop(2, true) : [],
        expectAnimationEnd(getAnimatableBehavior(box1)),
        expectAnimationEnd(getAnimatableBehavior(box3))
      ])
      expect(poped1?.id).toBe('box3')
      expectInteractible(poped1)
      expect(poped1.parent?.id).toBeUndefined()
      expect(poped2?.id).toBe('box1')
      expectInteractible(poped2)
      expect(poped2.parent?.id).toBeUndefined()
      expectStacked(managers, [mesh, box2])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id,
        args: [2, true],
        duration: behavior.state.duration,
        revert: [[poped2?.id, poped1?.id], true],
        fromHand: false,
        isLocal: false
      })
      expectPosition(poped1, [1.25, 0.5, 0])
      expectPosition(poped2, [2.5, 0.5, 0])
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped1)
      expectMoveRecorded(moveRecorded)
    })

    it('pops all meshes from a stack', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      let [poped1, poped2, poped3, poped4] = await (mesh.metadata.pop
        ? mesh.metadata.pop(4)
        : [])
      expect(poped1?.id).toBe('box3')
      expect(poped2?.id).toBe('box1')
      expect(poped3?.id).toBe('box2')
      expect(poped4?.id).toBe('box0')
      expectInteractible(poped1)
      expectInteractible(poped2)
      expectInteractible(poped3)
      expectInteractible(poped4)
      expect(poped1.parent?.id).toBeUndefined()
      expect(poped2.parent?.id).toBeUndefined()
      expect(poped3.parent?.id).toBeUndefined()
      expect(poped4.parent?.id).toBeUndefined()
      expectStacked(managers, [mesh])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id,
        args: [4, false],
        revert: [[poped4?.id, poped3?.id, poped2?.id, poped1?.id], false],
        fromHand: false,
        isLocal: false
      })
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped1)
      expectMoveRecorded(moveRecorded)
    })

    it('can pop from any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      const [poped] = await (box3.metadata.pop ? box3.metadata.pop() : [])
      expect(poped?.id).toBe('box2')
      expectInteractible(poped)
      expect(poped.parent?.id).toBeUndefined()
      expectStacked(managers, [mesh, box3, box1])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id,
        args: [1, false],
        revert: [[poped?.id], false],
        fromHand: false,
        isLocal: false
      })
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
      expectMoveRecorded(moveRecorded)
    })

    it('pops dragged meshes', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      managers.move.notifyMove(box2)
      expectInteractible(box2)
      expect(box2.parent?.id).toBeUndefined()
      expectStacked(managers, [mesh, box3, box1])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id,
        args: [1, false],
        revert: [[box2.id], false],
        fromHand: false,
        isLocal: false
      })
      expectMeshFeedback(registerFeedbackSpy, 'pop', box2)
    })

    it('pops last mesh when drawn', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      box2.metadata.draw?.()
      expectInteractible(box2)
      expect(box2.parent?.id).toBeUndefined()
      expectStacked(managers, [mesh, box3, box1])
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'draw',
        meshId: box2.id,
        args: expect.any(Array),
        fromHand: false,
        isLocal: false
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'pop',
        meshId: mesh.id,
        args: [1, false],
        revert: [[box2.id], false],
        fromHand: false,
        isLocal: true
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can not pop any mesh when drawn', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      box3.isPickable = false
      box3.metadata.draw?.()
      expectInteractible(box3, false, false)
      expectStacked(managers, [mesh, box3, box1, box2])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'draw',
        meshId: box3.id,
        args: expect.any(Array),
        fromHand: false,
        isLocal: false
      })
      expect(moveRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('does not enable locked mesh when poping', async () => {
      box3.addBehavior(new LockBehavior({ isLocked: true }, managers), true)
      expectInteractible(box3, true, false)
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      let [poped] = (await mesh.metadata.pop?.()) ?? []
      expect(poped?.id).toBe('box3')
      expectInteractible(poped, true, false)
      expect(poped.parent?.id).toBeUndefined()
      expectStacked(managers, [mesh, box2, box1])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id,
        args: [1, false],
        revert: [[poped?.id], false],
        fromHand: false,
        isLocal: false
      })
      expectStackIndicator(managers, poped)
      expectMoveRecorded(moveRecorded)
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
    })

    it('can revert a single poped mesh', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2'] })
      const [poped] = (await mesh.metadata.pop?.()) ?? []
      const position = poped.absolutePosition.asArray()
      poped.metadata.rotate?.()
      const angle = /** @type {number} */ (
        poped.getBehaviorByName(RotateBehaviorName)?.state.angle
      )
      expectRotated(poped, angle)
      expectStacked(managers, [mesh, box1])
      registerFeedbackSpy.mockClear()
      actionRecorded.mockClear()

      await behavior.revert('pop', [[poped.id], true])
      expectStacked(managers, [mesh, box1, box2])
      expectRotated(box2, 0)
      expect(registerFeedbackSpy).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith(
        expect.objectContaining({
          fn: 'push',
          meshId: mesh.id,
          args: [poped.id, true],
          revert: [1, true, position, 0],
          fromHand: false,
          isLocal: true
        })
      )
    })

    it('can revert multiple poped mesh', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      const [poped1, poped2] = (await mesh.metadata.pop?.(2, true)) ?? []
      const position1 = [1.25, 0.5, 0]
      expectPosition(poped1, position1)
      const position2 = [2.5, 0.5, 0]
      expectPosition(poped2, position2)
      expectStacked(managers, [mesh, box1])
      registerFeedbackSpy.mockClear()
      actionRecorded.mockClear()

      await behavior.revert('pop', [[poped2.id, poped1.id], false])
      expectStacked(managers, [mesh, box1, box2, box3])
      expect(registerFeedbackSpy).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          fn: 'push',
          meshId: mesh.id,
          args: [poped2.id, false],
          revert: [1, false, position2, 0],
          fromHand: false,
          isLocal: true
        })
      )
      expect(actionRecorded).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          fn: 'push',
          meshId: mesh.id,
          args: [poped1.id, false],
          revert: [1, false, position1, 0],
          fromHand: false,
          isLocal: true
        })
      )
    })

    it('reorders stack to given order', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      expectStacked(managers, [mesh, box1, box2, box3])

      await mesh.metadata.reorder?.(['box3', 'box2', 'box1', 'box0'], false)

      expectStacked(managers, [box3, box2, box1, mesh])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box3', 'box2', 'box1', 'box0'], false],
        revert: [['box0', 'box1', 'box2', 'box3'], false],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('reorders with animation', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      expectStacked(managers, [mesh, box1, box2, box3])

      await mesh.metadata.reorder?.(['box2', 'box0', 'box3', 'box1'])

      expectStacked(managers, [box2, mesh, box3, box1])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box2', 'box0', 'box3', 'box1'], true],
        revert: [['box0', 'box1', 'box2', 'box3'], true],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('keeps reordered stack snapped to an anchor', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2'] })
      box3.getBehaviorByName(AnchorBehaviorName)?.fromState({
        anchors: [{ id: '1', x: -0.5, snappedId: 'box0' }]
      })
      expectSnapped(box3, mesh)
      expectStacked(managers, [mesh, box1, box2], true, 'box3')

      await mesh.metadata.reorder?.(['box1', 'box0', 'box2'])

      expectStacked(managers, [box1, mesh, box2], true, 'box3')
      expectSnapped(box3, box1)

      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box1', 'box0', 'box2'], true],
        revert: [['box0', 'box1', 'box2'], true],
        fromHand: false,
        isLocal: false
      })
      expect(actionRecorded).toHaveBeenCalledOnce()
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can not reorder while reordering', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      const firstReordering = mesh.metadata.reorder?.([
        'box2',
        'box0',
        'box3',
        'box1'
      ])
      mesh.metadata.reorder?.(['box4', 'box3', 'box2', 'box1'])
      await firstReordering

      expectStacked(managers, [box2, mesh, box3, box1])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box2', 'box0', 'box3', 'box1'], true],
        revert: [['box0', 'box1', 'box2', 'box3'], true],
        fromHand: false,
        isLocal: false
      })
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can reorder any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      box3.metadata.reorder?.(['box0', 'box1', 'box2', 'box3'], false)

      expectStacked(managers, [mesh, box1, box2, box3])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box0', 'box1', 'box2', 'box3'], false],
        revert: [['box0', 'box2', 'box1', 'box3'], false],
        fromHand: false,
        isLocal: false
      })
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can move current mesh while reordering', async () => {
      behavior.fromState({ stackIds: ['box3', 'box2', 'box1'] })

      mesh.metadata.reorder?.(['box3', 'box0', 'box2', 'box1'], false)

      expectStacked(managers, [box3, mesh, box2, box1])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box3', 'box0', 'box2', 'box1'], false],
        revert: [['box0', 'box3', 'box2', 'box1'], false],
        fromHand: false,
        isLocal: false
      })
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can revert reordered meshes', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      expectStacked(managers, [mesh, box1, box2, box3])
      registerFeedbackSpy.mockClear()
      actionRecorded.mockClear()

      await behavior.revert('reorder', [
        ['box3', 'box2', 'box1', 'box0'],
        false
      ])
      expectStacked(managers, [box3, box2, box1, mesh])
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box3', 'box2', 'box1', 'box0'], false],
        revert: [['box0', 'box1', 'box2', 'box3'], false],
        fromHand: false,
        isLocal: true
      })
    })

    it('flips the entire stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      await mesh.metadata.flipAll?.()
      expectStacked(managers, [box3, box2, box1, mesh])
      expect(actionRecorded).toHaveBeenCalledTimes(6)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'flipAll',
        meshId: mesh.id,
        args: [],
        fromHand: false,
        isLocal: false
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'flip',
        meshId: mesh.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(3, {
        fn: 'flip',
        meshId: box1.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(4, {
        fn: 'flip',
        meshId: box2.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(5, {
        fn: 'flip',
        meshId: box3.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(6, {
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box3', 'box2', 'box1', 'box0'], false],
        revert: [['box0', 'box1', 'box2', 'box3'], false],
        fromHand: false,
        isLocal: true
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('flips an entire flipped stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      await mesh.metadata.flip?.()
      expectFlipped(mesh, true)
      actionRecorded.mockClear()
      await mesh.metadata.flipAll?.()
      expectStacked(managers, [box3, box2, box1, mesh])
      expect(actionRecorded).toHaveBeenCalledTimes(6)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'flipAll',
        meshId: mesh.id,
        args: [],
        fromHand: false,
        isLocal: false
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box3', 'box2', 'box1', 'box0'], false],
        revert: [['box0', 'box1', 'box2', 'box3'], false],
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(3, {
        fn: 'flip',
        meshId: box3.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(4, {
        fn: 'flip',
        meshId: box2.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(5, {
        fn: 'flip',
        meshId: box1.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(6, {
        fn: 'flip',
        meshId: mesh.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('flips an entire stack of one', async () => {
      await mesh.metadata.flipAll?.()
      expectStacked(managers, [mesh])
      expectFlipped(mesh, true)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'flipAll',
        meshId: mesh.id,
        args: [],
        fromHand: false,
        isLocal: false
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'flip',
        meshId: mesh.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('flips the entire stack from peer', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      managers.control.apply({ fn: 'flipAll', meshId: mesh.id, args: [] })

      await sleep(200)
      expectStacked(managers, [box3, box2, box1, mesh])
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('keeps flipped stack snapped to an anchor', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2'] })
      box3.getBehaviorByName(AnchorBehaviorName)?.fromState({
        anchors: [{ id: '1', x: -0.5, snappedId: 'box0' }]
      })
      expectSnapped(box3, mesh)

      await mesh.metadata.flipAll?.()
      expectStacked(managers, [box2, box1, mesh], true, 'box3')
      expectSnapped(box3, box2)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'flipAll',
        meshId: mesh.id,
        args: [],
        fromHand: false,
        isLocal: false
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'flip',
        meshId: mesh.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(3, {
        fn: 'flip',
        meshId: box1.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(4, {
        fn: 'flip',
        meshId: box2.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(5, {
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box2', 'box1', 'box0'], false],
        revert: [['box0', 'box1', 'box2'], false],
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenCalledTimes(5)
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can revert a flipped stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      await mesh.metadata.flipAll?.()
      expectStacked(managers, [box3, box2, box1, mesh])
      registerFeedbackSpy.mockClear()
      actionRecorded.mockClear()

      await behavior.revert('flipAll', [])
      expectStacked(managers, [mesh, box1, box2, box3])
      expect(actionRecorded).toHaveBeenCalledTimes(6)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'flipAll',
        meshId: box3.id,
        args: [],
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'reorder',
        meshId: box3.id,
        revert: [['box3', 'box2', 'box1', 'box0'], false],
        args: [['box0', 'box1', 'box2', 'box3'], false],
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(3, {
        fn: 'flip',
        meshId: mesh.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(4, {
        fn: 'flip',
        meshId: box1.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(5, {
        fn: 'flip',
        meshId: box2.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(6, {
        fn: 'flip',
        meshId: box3.id,
        args: [],
        duration: 100,
        fromHand: false,
        isLocal: true
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('rotates the entire stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      await mesh.metadata.rotate?.()
      expectStacked(managers, [mesh, box1, box2, box3])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'rotate',
        meshId: mesh.id,
        args: [Math.PI / 2],
        duration: 100,
        revert: [0],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('rotates an entire stack of one', async () => {
      await mesh.metadata.rotate?.()
      expectStacked(managers, [mesh])
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'rotate',
        meshId: mesh.id,
        args: [Math.PI / 2],
        duration: 100,
        revert: [0],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can not push no mesh', () => {
      // @ts-expect-error: no arguments
      expect(mesh.metadata.canPush?.()).toBe(false)
      // @ts-expect-error: null is not acceptable
      expect(mesh.metadata.canPush?.(null)).toBe(false)
    })

    it('can not push mesh with different kind', () => {
      behavior.fromState({ kinds: ['card'] })
      const moveBehavior = /** @type {MoveBehavior} */ (
        box1.getBehaviorByName(MoveBehaviorName)
      )
      moveBehavior.state.kind = 'token'
      expect(mesh.metadata.canPush?.(box1)).toBe(false)
      expect(mesh.metadata.canPush?.(box2)).toBe(false)
    })

    it('can push mesh with the same kind', () => {
      behavior.fromState({ kinds: ['card'] })
      const moveBehavior = /** @type {MoveBehavior} */ (
        box1.getBehaviorByName(MoveBehaviorName)
      )
      moveBehavior.state.kind = 'card'
      expect(mesh.metadata.canPush?.(box1)).toBe(true)
    })

    it('can push mesh with kind on kindless zone', () => {
      const moveBehavior = /** @type {MoveBehavior} */ (
        box1.getBehaviorByName(MoveBehaviorName)
      )
      moveBehavior.state.kind = 'card'
      expect(mesh.metadata.canPush?.(box1)).toBe(true)
    })

    it('can push on top of a stacked the entire stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2'] })
      expectStacked(managers, [mesh, box1, box2])
      expect(mesh.metadata.canPush?.(box3)).toBe(true)
    })
  })
})
