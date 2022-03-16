import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import {
  configures3dTestEngine,
  expectAnimationEnd,
  expectFlipped,
  expectInteractible,
  expectStacked,
  sleep
} from '../../test-utils'
import {
  AnchorBehavior,
  DrawBehavior,
  FlipBehavior,
  MoveBehavior,
  MoveBehaviorName,
  RotateBehavior,
  StackBehavior,
  StackBehaviorName
} from '../../../src/3d/behaviors'
import {
  controlManager,
  handManager,
  inputManager
} from '../../../src/3d/managers'
import {
  getAnimatableBehavior,
  getTargetableBehavior
} from '../../../src/3d/utils'

describe('StackBehavior', () => {
  configures3dTestEngine()

  let recordSpy

  beforeEach(() => {
    jest.clearAllMocks()
    recordSpy = jest.spyOn(controlManager, 'record')
    jest
      .spyOn(handManager, 'draw')
      .mockImplementation(mesh => controlManager.record({ mesh, fn: 'draw' }))
  })

  it('has initial state', () => {
    const state = {
      extent: faker.datatype.number(),
      duration: faker.datatype.number(),
      kinds: [],
      stackIds: []
    }
    const behavior = new StackBehavior(state)

    expect(behavior.name).toEqual(StackBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.stack).toEqual([])
    expect(behavior.base).toBeNull()
    expect(behavior.pushQueue).toEqual([])
    expect(behavior.inhibitControl).toBe(false)
    expect(behavior.mesh).toBeNull()
  })

  it('can not restore state without mesh', () => {
    expect(() => new StackBehavior().fromState({ duration: 100 })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can hydrate with default state', () => {
    const behavior = new StackBehavior()
    const mesh = CreateBox('box0', {})
    mesh.addBehavior(behavior, true)

    behavior.fromState()
    expect(behavior.state).toEqual({
      extent: 0.3,
      duration: 100,
      stackIds: []
    })
    expect(behavior.mesh).toEqual(mesh)
    expect(mesh.metadata.stack).toEqual([mesh])
  })

  it('can hydrate with stacked mesh', () => {
    const stacked = CreateBox('box1', {})
    stacked.addBehavior(new StackBehavior(), true)

    const mesh = CreateBox('box0', {})
    mesh.addBehavior(new StackBehavior({ stackIds: [stacked.id] }), true)
    expectStacked([mesh, stacked])
  })

  it('can not push mesh', () => {
    expect(new StackBehavior().canPush(CreateBox('box1', {}))).toBe(false)
  })

  describe('given attached to a mesh', () => {
    let mesh
    let meshes = []
    let behavior

    beforeEach(() => {
      ;[mesh, ...meshes] = Array.from({ length: 4 }, (_, rank) => {
        const box = CreateBox(`box${rank}`, {})
        box.setAbsolutePosition(new Vector3(rank, rank, rank))
        box.addBehavior(new StackBehavior({ duration: 10 }), true)
        box.addBehavior(new FlipBehavior({ duration: 100 }), true)
        box.addBehavior(new RotateBehavior(), true)
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
      expectZone(behavior, 0.3, true)
      expectStacked([mesh])
      expect(behavior.state.duration).toEqual(10)
      expect(behavior.state.extent).toEqual(0.3)
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
    })

    it('can hydrate from state', async () => {
      const extent = faker.datatype.number()
      const stackIds = [meshes[0].id, meshes[2].id]
      const duration = faker.datatype.number()
      const kinds = ['card']
      const priority = faker.datatype.number()
      expect(meshes[0].absolutePosition).toEqual(Vector3.FromArray([1, 1, 1]))
      expect(meshes[2].absolutePosition).toEqual(Vector3.FromArray([3, 3, 3]))

      behavior.fromState({ duration, extent, stackIds, kinds, priority })
      expectZone(behavior, extent, false, kinds, priority)
      expectStacked([mesh, meshes[0], meshes[2]])
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
    })

    it('pushes new mesh on stack', async () => {
      expectStacked([mesh])
      expect(meshes[0].absolutePosition).toEqual(Vector3.FromArray([1, 1, 1]))

      await mesh.metadata.push(meshes[0].id)
      expectStacked([mesh, meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'push',
        mesh,
        args: [meshes[0].id]
      })
    })

    it('can push on any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1'] })

      await meshes[1].metadata.push(meshes[2].id)
      expectStacked([mesh, meshes[1], meshes[0], meshes[2]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'push',
        mesh,
        args: [meshes[2].id]
      })
    })

    it('pushes dropped meshes', async () => {
      behavior.fromState({ stackIds: ['box2'] })
      const targetable = getTargetableBehavior(meshes[1])

      targetable.onDropObservable.notifyObservers({
        dropped: [meshes[0], meshes[2]],
        zone: targetable.zones[0]
      })
      await sleep(behavior.state.duration)
      expectStacked([mesh, meshes[1], meshes[0], meshes[2]])
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        fn: 'push',
        mesh,
        args: [meshes[0].id]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'push',
        mesh,
        args: [meshes[2].id]
      })
    })

    it('pushes a stack of meshes on stack', async () => {
      behavior.fromState({ stackIds: ['box1'] })
      expectStacked([mesh, meshes[0]])

      meshes[1]
        .getBehaviorByName(StackBehaviorName)
        .fromState({ stackIds: ['box3'] })
      expectStacked([meshes[1], meshes[2]])

      await mesh.metadata.push(meshes[1].id)
      expectStacked([mesh, meshes[0], meshes[1], meshes[2]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'push',
        mesh,
        args: [meshes[1].id]
      })
    })

    it('can not pop an empty stack', async () => {
      expect(await mesh.metadata.pop()).not.toBeDefined()
      expectStacked([mesh])
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('pops last mesh from stack', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      let poped = await mesh.metadata.pop()
      expect(poped?.id).toBe('box3')
      expectInteractible(poped)
      expectStacked([mesh, meshes[1], meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({ fn: 'pop', mesh })

      poped = await mesh.metadata.pop()
      expect(poped?.id).toBe('box1')
      expectInteractible(poped)
      expectStacked([mesh, meshes[1]])
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(2, { fn: 'pop', mesh })
    })

    it('can pop from any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      let poped = await meshes[2].metadata.pop()
      expect(poped?.id).toBe('box2')
      expectInteractible(poped)
      expectStacked([mesh, meshes[2], meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({ fn: 'pop', mesh })
    })

    it('pops dragged meshes', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        mesh: meshes[1]
      })
      expectInteractible(meshes[1])
      expectStacked([mesh, meshes[2], meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({ fn: 'pop', mesh })
    })

    it('pops last mesh when drawn', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      meshes[1].metadata.draw()
      expectInteractible(meshes[1])
      expectStacked([mesh, meshes[2], meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({ fn: 'draw', mesh: meshes[1] })
    })

    it('pops any mesh when drawn', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      meshes[2].isPickable = false
      meshes[2].metadata.draw()
      await expectAnimationEnd(getAnimatableBehavior(meshes[0]))
      expectInteractible(meshes[2])
      expectStacked([mesh, meshes[0], meshes[1]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({ fn: 'draw', mesh: meshes[2] })
    })

    it('reorders stack to given order', async () => {
      behavior.fromState({ stackIds: ['box3', 'box2', 'box1'] })

      await mesh.metadata.reorder(['box0', 'box1', 'box2', 'box3'], false)

      expectStacked([mesh, meshes[0], meshes[1], meshes[2]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        mesh,
        args: [['box0', 'box1', 'box2', 'box3'], false]
      })
    })

    it('reorders with animation', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      await mesh.metadata.reorder(['box2', 'box0', 'box3', 'box1'])

      expectStacked([meshes[1], mesh, meshes[2], meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        mesh,
        args: [['box2', 'box0', 'box3', 'box1'], true]
      })
    })

    it('can reorder any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      meshes[2].metadata.reorder(['box0', 'box1', 'box2', 'box3'], false)

      expectStacked([mesh, meshes[0], meshes[1], meshes[2]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        mesh,
        args: [['box0', 'box1', 'box2', 'box3'], false]
      })
    })

    it('can move current mesh while reordering', async () => {
      behavior.fromState({ stackIds: ['box3', 'box2', 'box1'] })

      mesh.metadata.reorder(['box3', 'box0', 'box2', 'box1'], false)

      expectStacked([meshes[2], mesh, meshes[1], meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        mesh,
        args: [['box3', 'box0', 'box2', 'box1'], false]
      })
    })

    it('flips the entire stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      await mesh.metadata.flipAll()
      expectStacked([meshes[2], meshes[1], meshes[0], mesh])
      expect(recordSpy).toHaveBeenCalledTimes(6)
      expect(recordSpy).toHaveBeenNthCalledWith(1, { fn: 'flipAll', mesh })
      expect(recordSpy).toHaveBeenNthCalledWith(2, { fn: 'flip', mesh })
      expect(recordSpy).toHaveBeenNthCalledWith(3, {
        fn: 'flip',
        mesh: meshes[0]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(4, {
        fn: 'flip',
        mesh: meshes[1]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(5, {
        fn: 'flip',
        mesh: meshes[2]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(6, {
        fn: 'reorder',
        mesh,
        args: [['box3', 'box2', 'box1', 'box0'], false]
      })
    })

    it('flips an entire flipped stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      await mesh.metadata.flip()
      expectFlipped(mesh, true)
      recordSpy.mockReset()

      await mesh.metadata.flipAll()
      expectStacked([meshes[2], meshes[1], meshes[0], mesh])
      expect(recordSpy).toHaveBeenCalledTimes(6)
      expect(recordSpy).toHaveBeenNthCalledWith(1, { fn: 'flipAll', mesh })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'reorder',
        mesh,
        args: [['box3', 'box2', 'box1', 'box0'], false]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(3, {
        fn: 'flip',
        mesh: meshes[2]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(4, {
        fn: 'flip',
        mesh: meshes[1]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(5, {
        fn: 'flip',
        mesh: meshes[0]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(6, { fn: 'flip', mesh })
    })

    it('flips an entire stack of one', async () => {
      await mesh.metadata.flipAll()
      expectStacked([mesh])
      expectFlipped(mesh, true)
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(1, { fn: 'flipAll', mesh })
      expect(recordSpy).toHaveBeenNthCalledWith(2, { fn: 'flip', mesh })
    })

    it('flips the entire stack from peer', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })
      controlManager.apply({ fn: 'flipAll', meshId: mesh.id }, true)
      controlManager.apply({ fn: 'flipAll', meshId: mesh.id }, true)
      controlManager.apply({ fn: 'flip', meshId: mesh.id }, true)
      controlManager.apply({ fn: 'flip', meshId: meshes[0].id }, true)
      controlManager.apply({ fn: 'flip', meshId: meshes[1].id }, true)
      controlManager.apply({ fn: 'flip', meshId: meshes[2].id }, true)
      controlManager.apply({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box3', 'box2', 'box1', 'box0'], false]
      })

      await sleep(200)
      expectStacked([meshes[2], meshes[1], meshes[0], mesh])
    })

    it('rotates the entire stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      await mesh.metadata.rotate()
      expectStacked([mesh, meshes[0], meshes[1], meshes[2]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenNthCalledWith(1, { fn: 'rotate', mesh })
    })

    it('rotates an entire stack of one', async () => {
      await mesh.metadata.rotate()
      expectStacked([mesh])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({ fn: 'rotate', mesh })
    })

    it('can not push no mesh', () => {
      expect(mesh.metadata.canPush()).toBe(false)
      expect(mesh.metadata.canPush(null)).toBe(false)
    })

    it('can not push mesh with different kind', () => {
      behavior.fromState({ kinds: ['card'] })
      meshes[0].getBehaviorByName(MoveBehaviorName).state.kind = 'token'
      expect(mesh.metadata.canPush(meshes[0])).toBe(false)
      expect(mesh.metadata.canPush(meshes[1])).toBe(false)
    })

    it('can push mesh with the same kind', () => {
      behavior.fromState({ kinds: ['card'] })
      meshes[0].getBehaviorByName(MoveBehaviorName).state.kind = 'card'
      expect(mesh.metadata.canPush(meshes[0])).toBe(true)
    })

    it('can push mesh with kind on kindless zone', () => {
      meshes[0].getBehaviorByName(MoveBehaviorName).state.kind = 'card'
      expect(mesh.metadata.canPush(meshes[0])).toBe(true)
    })

    it('can push on top of a stacked the entire stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2'] })
      expectStacked([mesh, meshes[0], meshes[1]])
      expect(mesh.metadata.canPush(meshes[2])).toBe(true)
    })
  })
})

function expectZone(behavior, extent, enabled, kinds, priority = 0) {
  expect(behavior.zones).toHaveLength(1)
  expect(behavior.zones[0].extent).toEqual(extent)
  expect(behavior.zones[0].enabled).toEqual(enabled)
  expect(behavior.zones[0].kinds).toEqual(kinds)
  expect(behavior.zones[0].priority).toEqual(priority)
  expect(behavior.zones[0].mesh?.parent?.id).toEqual(behavior.mesh.id)
}
