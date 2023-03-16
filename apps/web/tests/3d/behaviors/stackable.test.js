import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import {
  AnchorBehavior,
  DrawBehavior,
  FlipBehavior,
  FlipBehaviorName,
  LockBehavior,
  MoveBehavior,
  MoveBehaviorName,
  RotateBehavior,
  RotateBehaviorName,
  StackBehavior,
  StackBehaviorName
} from '@src/3d/behaviors'
import {
  controlManager,
  handManager,
  indicatorManager,
  moveManager
} from '@src/3d/managers'
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
  expectStacked,
  expectStackIndicator,
  expectZone,
  sleep
} from '../../test-utils'

describe('StackBehavior', () => {
  configures3dTestEngine(created => (scene = created.scene))

  const moveRecorded = vi.fn()
  let recordSpy
  let registerFeedbackSpy
  let moveObserver
  let scene

  beforeAll(() => {
    moveObserver = moveManager.onMoveObservable.add(moveRecorded)
    indicatorManager.init({ scene })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    recordSpy = vi.spyOn(controlManager, 'record')
    registerFeedbackSpy = vi.spyOn(indicatorManager, 'registerFeedback')
    vi.spyOn(handManager, 'draw').mockImplementation(mesh =>
      controlManager.record({ mesh, fn: 'draw' })
    )
  })

  afterAll(() => moveManager.onMoveObservable.remove(moveObserver))

  it('has initial state', () => {
    const state = {
      extent: faker.datatype.number(),
      duration: faker.datatype.number(),
      kinds: [],
      stackIds: [],
      angle: faker.datatype.number()
    }
    const behavior = new StackBehavior(state)

    expect(behavior.name).toEqual(StackBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.stack).toEqual([])
    expect(behavior.base).toBeNull()
    expect(behavior.inhibitControl).toBe(false)
    expect(behavior.mesh).toBeNull()
    expect(recordSpy).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new StackBehavior().fromState({ duration: 100 })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can hydrate with default state', () => {
    const behavior = new StackBehavior()
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
    expectStackIndicator(mesh)
    expect(recordSpy).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can hydrate with stacked mesh', () => {
    const stacked = createBox('box1', {})
    stacked.addBehavior(new StackBehavior(), true)

    const mesh = createBox('box0', {})
    mesh.addBehavior(new StackBehavior({ stackIds: [stacked.id] }), true)
    expectStacked([mesh, stacked])
    expectMoveRecorded(moveRecorded)
    expect(recordSpy).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not push mesh', () => {
    expect(new StackBehavior().canPush(createBox('box1', {}))).toBe(false)
  })

  describe('given attached to a mesh', () => {
    let mesh, box1, box2, box3
    let behavior

    beforeEach(() => {
      ;[mesh, box1, box2, box3] = Array.from({ length: 4 }, (_, rank) => {
        const box = createBox(`box${rank}`, {})
        box.setAbsolutePosition(new Vector3(rank, rank, rank))
        box.addBehavior(new StackBehavior({ duration: 10 }), true)
        box.addBehavior(new FlipBehavior({ duration: 100 }), true)
        box.addBehavior(new RotateBehavior({ duration: 100 }), true)
        box.addBehavior(new MoveBehavior(), true)
        box.addBehavior(
          new AnchorBehavior({ anchors: [{ x: -0.5 }, { x: 0.5 }] })
        )
        box.addBehavior(new DrawBehavior(), true)
        controlManager.registerControlable(box)
        return box
      })

      behavior = getTargetableBehavior(mesh)
    })

    it('attaches metadata to its mesh', () => {
      expectZone(behavior, { extent: 2, enabled: true, ignoreParts: true })
      expectStacked([mesh])
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
      expect(recordSpy).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can hydrate from state', async () => {
      const extent = faker.datatype.number()
      const stackIds = [box1.id, box3.id]
      const duration = faker.datatype.number()
      const kinds = ['card']
      const priority = faker.datatype.number()
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
      expectStacked([mesh, box1, box3])
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
      expect(recordSpy).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can hydrate with cylindric zone', async () => {
      const extent = faker.datatype.number()
      const stackIds = [box1.id, box3.id]
      const duration = faker.datatype.number()
      const kinds = ['tokens']
      const priority = faker.datatype.number()
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
      expectStacked([mesh, box1, box3])
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
      expect(recordSpy).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can rotate mesh when hydrating from state', async () => {
      const stackIds = [box1.id, box3.id]
      box3
        .getBehaviorByName(RotateBehaviorName)
        .fromState({ duration: 100, angle: Math.PI * 0.5 })
      expectRotated(box3, Math.PI * 0.5)

      behavior.fromState({ stackIds, angle: 0 })
      expectRotated(box3, 0)
      expectZone(behavior, { extent: 2, enabled: false, ignoreParts: true })
      expectStacked([mesh, box1, box3])
      expect(recordSpy).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('does not enable locked meshes when hydrating', async () => {
      const extent = faker.datatype.number()
      const stackIds = [box1.id, box3.id]
      const duration = faker.datatype.number()
      const kinds = ['card']
      const priority = faker.datatype.number()
      expect(box1.absolutePosition).toEqual(Vector3.FromArray([1, 1, 1]))
      expect(box3.absolutePosition).toEqual(Vector3.FromArray([3, 3, 3]))
      mesh.addBehavior(new LockBehavior({ isLocked: true }), true)
      box1.addBehavior(new LockBehavior({ isLocked: true }), true)
      box3.addBehavior(new LockBehavior({ isLocked: true }), true)

      behavior.fromState({ duration, extent, stackIds, kinds, priority })
      expectZone(behavior, {
        extent,
        enabled: false,
        kinds,
        priority,
        ignoreParts: true
      })
      expectStacked([mesh, box1, box3], false)
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
      expect(recordSpy).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('pushes new mesh on stack', async () => {
      expectStacked([mesh])
      expect(box1.absolutePosition).toEqual(Vector3.FromArray([1, 1, 1]))

      await mesh.metadata.push(box1.id)
      expectStacked([mesh, box1])
      expectRotated(box1, 0)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'push',
        mesh,
        args: [box1.id, false],
        duration: behavior.state.duration
      })
      expectMoveRecorded(moveRecorded, box1)
      expectMeshFeedback(registerFeedbackSpy, 'push', box1)
    })

    it('can push on any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1'] })

      await box2.metadata.push(box3.id)
      expectStacked([mesh, box2, box1, box3])
      expectRotated(box1, 0)
      expectRotated(box2, 0)
      expectRotated(box3, 0)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'push',
        mesh,
        args: [box3.id, false],
        duration: box2.getBehaviorByName(StackBehaviorName).state.duration
      })
      expectMoveRecorded(moveRecorded, box3)
      expectMeshFeedback(registerFeedbackSpy, 'push', box3)
    })

    it('can rotate mesh when pushing them', async () => {
      const baseAngle = Math.PI * 0.5
      mesh
        .getBehaviorByName(RotateBehaviorName)
        .fromState({ duration: 100, angle: baseAngle })
      expectRotated(mesh, baseAngle)
      const angle = Math.PI
      box1
        .getBehaviorByName(RotateBehaviorName)
        .fromState({ duration: 100, angle: Math.PI * -0.5 })
      box1
        .getBehaviorByName(FlipBehaviorName)
        .fromState({ duration: 100, isFlipped: true })
      behavior.fromState({ angle })
      expectStacked([mesh])
      expect(box1.absolutePosition).toEqual(Vector3.FromArray([1, 1, 1]))

      await mesh.metadata.push(box1.id)
      expectRotated(box1, baseAngle - angle)
      expectFlipped(box1)
      expectStacked([mesh, box1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'push',
        mesh,
        args: [box1.id, false],
        duration: behavior.state.duration
      })
      expectMoveRecorded(moveRecorded, box1)
      expectMeshFeedback(registerFeedbackSpy, 'push', box1)
    })

    it('does not enable locked mesh when pushing', async () => {
      box1.addBehavior(new LockBehavior({ isLocked: true }), true)
      expectStacked([mesh])
      expectInteractible(mesh, true)
      expectInteractible(box1, true, false)

      await mesh.metadata.push(box1.id)
      expectStacked([mesh, box1], false)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'push',
        mesh,
        args: [box1.id, false],
        duration: behavior.state.duration
      })
      expectMoveRecorded(moveRecorded, box1)
      expectMeshFeedback(registerFeedbackSpy, 'push', box1)
    })

    it('pushes dropped meshes', async () => {
      behavior.fromState({ stackIds: ['box2'] })
      const targetable = getTargetableBehavior(box2)

      targetable.onDropObservable.notifyObservers({
        dropped: [box1, box3],
        zone: targetable.zones[0]
      })
      await sleep(behavior.state.duration)
      expectStacked([mesh, box2, box1, box3])
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        fn: 'push',
        mesh,
        args: [box1.id, false],
        duration: box2.getBehaviorByName(StackBehaviorName).state.duration
      })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'push',
        mesh,
        args: [box3.id, false],
        duration: box2.getBehaviorByName(StackBehaviorName).state.duration
      })
      expectMoveRecorded(moveRecorded, box1, box3)
      expectMeshFeedback(registerFeedbackSpy, 'push', box1, box3)
    })

    it('pushes a stack of meshes on stack', async () => {
      behavior.fromState({ stackIds: ['box1'] })
      expectStacked([mesh, box1])

      box2
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['box3'] })
      expectStacked([box2, box3])

      await mesh.metadata.push(box2.id)
      expectStacked([mesh, box1, box2, box3])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'push',
        mesh,
        args: [box2.id, false],
        duration: behavior.state.duration
      })
      expectMoveRecorded(moveRecorded, box2)
      expectMeshFeedback(registerFeedbackSpy, 'push', box2)
    })

    it('can not pop an empty stack', async () => {
      expect(await mesh.metadata.pop()).toEqual([])
      expectStacked([mesh])
      expect(recordSpy).not.toHaveBeenCalled()
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('pops last mesh from stack', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      let [poped] = await mesh.metadata.pop()
      expect(poped?.id).toBe('box3')
      expectInteractible(poped)
      expectStacked([mesh, box2, box1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'pop',
        mesh,
        args: [1, false]
      })
      expectStackIndicator(poped)
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
      ;[poped] = await mesh.metadata.pop()
      expect(poped?.id).toBe('box1')
      expectInteractible(poped)
      expectStacked([mesh, box2])
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'pop',
        mesh,
        args: [1, false]
      })
      expectStackIndicator(poped)
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
      ;[poped] = await mesh.metadata.pop()
      expect(poped?.id).toBe('box2')
      expectInteractible(poped)
      expectStacked([mesh])
      expect(recordSpy).toHaveBeenCalledTimes(3)
      expect(recordSpy).toHaveBeenNthCalledWith(3, {
        fn: 'pop',
        mesh,
        args: [1, false]
      })
      expectStackIndicator(poped)
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
      expectMoveRecorded(moveRecorded)
    })

    it('pops and moves a single mesh from stack', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      const [[poped]] = await Promise.all([
        mesh.metadata.pop(1, true),
        expectAnimationEnd(getAnimatableBehavior(box3))
      ])
      expect(poped?.id).toBe('box3')
      expectInteractible(poped)
      expectStacked([mesh, box2, box1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'pop',
        mesh,
        args: [1, true],
        duration: behavior.state.duration
      })
      expectPosition(poped, [1.25, 0.5, 0])
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
      expectMoveRecorded(moveRecorded)
    })

    it('pops and moves multiple meshes from stack', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      const [[poped1, poped2]] = await Promise.all([
        mesh.metadata.pop(2, true),
        expectAnimationEnd(getAnimatableBehavior(box1)),
        expectAnimationEnd(getAnimatableBehavior(box3))
      ])
      expect(poped1?.id).toBe('box3')
      expectInteractible(poped1)
      expect(poped2?.id).toBe('box1')
      expectInteractible(poped2)
      expectStacked([mesh, box2])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'pop',
        mesh,
        args: [2, true],
        duration: behavior.state.duration
      })
      expectPosition(poped1, [1.25, 0.5, 0])
      expectPosition(poped2, [2.5, 0.5, 0])
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped1)
      expectMoveRecorded(moveRecorded)
    })

    it('pops all meshes from a stack', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      let [poped1, poped2, poped3, poped4] = await mesh.metadata.pop(4)
      expect(poped1?.id).toBe('box3')
      expect(poped2?.id).toBe('box1')
      expect(poped3?.id).toBe('box2')
      expect(poped4?.id).toBe('box0')
      expectInteractible(poped1)
      expectInteractible(poped2)
      expectInteractible(poped3)
      expectInteractible(poped4)
      expectStacked([mesh])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'pop',
        mesh,
        args: [4, false]
      })
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped1)
      expectMoveRecorded(moveRecorded)
    })

    it('can pop from any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      const [poped] = await box3.metadata.pop()
      expect(poped?.id).toBe('box2')
      expectInteractible(poped)
      expectStacked([mesh, box3, box1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'pop',
        mesh,
        args: [1, false]
      })
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
      expectMoveRecorded(moveRecorded)
    })

    it('pops dragged meshes', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      moveManager.notifyMove(box2)
      expectInteractible(box2)
      expectStacked([mesh, box3, box1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'pop',
        mesh,
        args: [1, false]
      })
      expectMeshFeedback(registerFeedbackSpy, 'pop', box2)
    })

    it('pops last mesh when drawn', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      box2.metadata.draw()
      expectInteractible(box2)
      expectStacked([mesh, box3, box1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({ fn: 'draw', mesh: box2 })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('pops any mesh when drawn', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      box3.isPickable = false
      box3.metadata.draw()
      await expectAnimationEnd(getAnimatableBehavior(box1))
      expectInteractible(box3)
      expectStacked([mesh, box1, box2])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({ fn: 'draw', mesh: box3 })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('does not enable locked mesh when poping', async () => {
      box3.addBehavior(new LockBehavior({ isLocked: true }), true)
      expectInteractible(box3, true, false)
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      let [poped] = await mesh.metadata.pop()
      expect(poped?.id).toBe('box3')
      expectInteractible(poped, true, false)
      expectStacked([mesh, box2, box1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'pop',
        mesh,
        args: [1, false]
      })
      expectStackIndicator(poped)
      expectMoveRecorded(moveRecorded)
      expectMeshFeedback(registerFeedbackSpy, 'pop', poped)
    })

    it('reorders stack to given order', async () => {
      behavior.fromState({ stackIds: ['box3', 'box2', 'box1'] })

      await mesh.metadata.reorder(['box0', 'box1', 'box2', 'box3'], false)

      expectStacked([mesh, box1, box2, box3])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        mesh,
        args: [['box0', 'box1', 'box2', 'box3'], false]
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('reorders with animation', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      await mesh.metadata.reorder(['box2', 'box0', 'box3', 'box1'])

      expectStacked([box2, mesh, box3, box1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        mesh,
        args: [['box2', 'box0', 'box3', 'box1'], true]
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can not reorder while reordering', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      const firstReordering = mesh.metadata.reorder([
        'box2',
        'box0',
        'box3',
        'box1'
      ])
      mesh.metadata.reorder(['box4', 'box3', 'box2', 'box1'])
      await firstReordering

      expectStacked([box2, mesh, box3, box1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        mesh,
        args: [['box2', 'box0', 'box3', 'box1'], true]
      })
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can reorder any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      box3.metadata.reorder(['box0', 'box1', 'box2', 'box3'], false)

      expectStacked([mesh, box1, box2, box3])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        mesh,
        args: [['box0', 'box1', 'box2', 'box3'], false]
      })
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can move current mesh while reordering', async () => {
      behavior.fromState({ stackIds: ['box3', 'box2', 'box1'] })

      mesh.metadata.reorder(['box3', 'box0', 'box2', 'box1'], false)

      expectStacked([box3, mesh, box2, box1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        mesh,
        args: [['box3', 'box0', 'box2', 'box1'], false]
      })
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('flips the entire stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      await mesh.metadata.flipAll()
      expectStacked([box3, box2, box1, mesh])
      expect(recordSpy).toHaveBeenCalledTimes(6)
      expect(recordSpy).toHaveBeenNthCalledWith(1, { fn: 'flipAll', mesh })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'flip',
        mesh,
        duration: 100
      })
      expect(recordSpy).toHaveBeenNthCalledWith(3, {
        fn: 'flip',
        mesh: box1,
        duration: 100
      })
      expect(recordSpy).toHaveBeenNthCalledWith(4, {
        fn: 'flip',
        mesh: box2,
        duration: 100
      })
      expect(recordSpy).toHaveBeenNthCalledWith(5, {
        fn: 'flip',
        mesh: box3,
        duration: 100
      })
      expect(recordSpy).toHaveBeenNthCalledWith(6, {
        fn: 'reorder',
        mesh,
        args: [['box3', 'box2', 'box1', 'box0'], false]
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('flips an entire flipped stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      await mesh.metadata.flip()
      expectFlipped(mesh, true)
      recordSpy.mockReset()

      await mesh.metadata.flipAll()
      expectStacked([box3, box2, box1, mesh])
      expect(recordSpy).toHaveBeenCalledTimes(6)
      expect(recordSpy).toHaveBeenNthCalledWith(1, { fn: 'flipAll', mesh })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'reorder',
        mesh,
        args: [['box3', 'box2', 'box1', 'box0'], false]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(3, {
        fn: 'flip',
        mesh: box3,
        duration: 100
      })
      expect(recordSpy).toHaveBeenNthCalledWith(4, {
        fn: 'flip',
        mesh: box2,
        duration: 100
      })
      expect(recordSpy).toHaveBeenNthCalledWith(5, {
        fn: 'flip',
        mesh: box1,
        duration: 100
      })
      expect(recordSpy).toHaveBeenNthCalledWith(6, {
        fn: 'flip',
        mesh,
        duration: 100
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('flips an entire stack of one', async () => {
      await mesh.metadata.flipAll()
      expectStacked([mesh])
      expectFlipped(mesh, true)
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(1, { fn: 'flipAll', mesh })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'flip',
        mesh,
        duration: 100
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('flips the entire stack from peer', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      controlManager.apply({ fn: 'flipAll', meshId: mesh.id }, true)
      controlManager.apply({ fn: 'flipAll', meshId: mesh.id }, true)
      controlManager.apply({ fn: 'flip', meshId: mesh.id }, true)
      controlManager.apply({ fn: 'flip', meshId: box1.id }, true)
      controlManager.apply({ fn: 'flip', meshId: box2.id }, true)
      controlManager.apply({ fn: 'flip', meshId: box3.id }, true)
      controlManager.apply({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box3', 'box2', 'box1', 'box0'], false]
      })

      await sleep(200)
      expectStacked([box3, box2, box1, mesh])
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('rotates the entire stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      await mesh.metadata.rotate()
      expectStacked([mesh, box1, box2, box3])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        fn: 'rotate',
        mesh,
        duration: 100
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('rotates an entire stack of one', async () => {
      await mesh.metadata.rotate()
      expectStacked([mesh])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'rotate',
        mesh,
        duration: 100
      })
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can not push no mesh', () => {
      expect(mesh.metadata.canPush()).toBe(false)
      expect(mesh.metadata.canPush(null)).toBe(false)
    })

    it('can not push mesh with different kind', () => {
      behavior.fromState({ kinds: ['card'] })
      box1.getBehaviorByName(MoveBehaviorName).state.kind = 'token'
      expect(mesh.metadata.canPush(box1)).toBe(false)
      expect(mesh.metadata.canPush(box2)).toBe(false)
    })

    it('can push mesh with the same kind', () => {
      behavior.fromState({ kinds: ['card'] })
      box1.getBehaviorByName(MoveBehaviorName).state.kind = 'card'
      expect(mesh.metadata.canPush(box1)).toBe(true)
    })

    it('can push mesh with kind on kindless zone', () => {
      box1.getBehaviorByName(MoveBehaviorName).state.kind = 'card'
      expect(mesh.metadata.canPush(box1)).toBe(true)
    })

    it('can push on top of a stacked the entire stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2'] })
      expectStacked([mesh, box1, box2])
      expect(mesh.metadata.canPush(box3)).toBe(true)
    })
  })
})
