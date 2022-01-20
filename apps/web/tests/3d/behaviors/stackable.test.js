import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import { configures3dTestEngine, sleep } from '../../test-utils'
import {
  FlipBehavior,
  MoveBehavior,
  MoveBehaviorName,
  RotateBehavior,
  StackBehavior,
  StackBehaviorName
} from '../../../src/3d/behaviors'
import { controlManager, inputManager } from '../../../src/3d/managers'
import { getPositionAbove, getTargetableBehavior } from '../../../src/3d/utils'

describe('StackBehavior', () => {
  configures3dTestEngine()

  const recordSpy = jest.spyOn(controlManager, 'record')

  beforeEach(jest.resetAllMocks)

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
        controlManager.registerControlable(box)
        return box
      })

      behavior = getTargetableBehavior(mesh)
    })

    it('attaches metadata to its mesh', () => {
      expectZone(behavior, 0.3, true)
      expectStack([mesh])
      expect(behavior.state.duration).toEqual(10)
      expect(behavior.state.extent).toEqual(0.3)
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          push: expect.any(Function),
          pop: expect.any(Function),
          reorder: expect.any(Function),
          flipAll: expect.any(Function),
          rotateAll: expect.any(Function)
        })
      )
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('can hydrate from state', async () => {
      const extent = faker.datatype.number()
      const stackIds = [meshes[0].id, meshes[2].id]
      const duration = faker.datatype.number()
      expect(meshes[0].absolutePosition).toEqual(Vector3.FromArray([1, 1, 1]))
      expect(meshes[2].absolutePosition).toEqual(Vector3.FromArray([3, 3, 3]))

      behavior.fromState({ duration, extent, stackIds })
      expectZone(behavior, extent, false)
      expectStack([mesh, meshes[0], meshes[2]])
      expect(behavior.state.duration).toEqual(duration)
      expect(behavior.state.extent).toEqual(extent)
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          push: expect.any(Function),
          pop: expect.any(Function),
          reorder: expect.any(Function),
          flipAll: expect.any(Function),
          rotateAll: expect.any(Function)
        })
      )
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('pushes new mesh on stack', async () => {
      expectStack([mesh])
      expect(meshes[0].absolutePosition).toEqual(Vector3.FromArray([1, 1, 1]))

      await mesh.metadata.push(meshes[0].id)
      expectStack([mesh, meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'push',
        meshId: mesh.id,
        args: [meshes[0].id]
      })
    })

    it('can push on any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1'] })

      await meshes[1].metadata.push(meshes[2].id)
      expectStack([mesh, meshes[1], meshes[0], meshes[2]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'push',
        meshId: mesh.id,
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
      expectStack([mesh, meshes[1], meshes[0], meshes[2]])
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        fn: 'push',
        meshId: mesh.id,
        args: [meshes[0].id]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'push',
        meshId: mesh.id,
        args: [meshes[2].id]
      })
    })

    it('can not pop an empty stack', async () => {
      expect(await mesh.metadata.pop()).not.toBeDefined()
      expectStack([mesh])
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('pops last mesh from stack', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      let poped = await mesh.metadata.pop()
      expect(poped?.id).toBe('box3')
      expectInteractible(poped)
      expectStack([mesh, meshes[1], meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id
      })

      poped = await mesh.metadata.pop()
      expect(poped?.id).toBe('box1')
      expectInteractible(poped)
      expectStack([mesh, meshes[1]])
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'pop',
        meshId: mesh.id
      })
    })

    it('can pop from any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      let poped = await meshes[2].metadata.pop()
      expect(poped?.id).toBe('box2')
      expectInteractible(poped)
      expectStack([mesh, meshes[2], meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id
      })
    })

    it('pops dragged meshes', async () => {
      behavior.fromState({ stackIds: ['box3', 'box1', 'box2'] })

      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        mesh: meshes[1]
      })
      expectInteractible(meshes[1])
      expectStack([mesh, meshes[2], meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'pop',
        meshId: mesh.id
      })
    })

    it('reorders stack to given order', async () => {
      behavior.fromState({ stackIds: ['box3', 'box2', 'box1'] })

      await mesh.metadata.reorder(['box0', 'box1', 'box2', 'box3'], false)

      expectStack([mesh, meshes[0], meshes[1], meshes[2]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box0', 'box1', 'box2', 'box3'], false]
      })
    })

    it('reorders with animation', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      await mesh.metadata.reorder(['box2', 'box0', 'box3', 'box1'])

      expectStack([meshes[1], mesh, meshes[2], meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box2', 'box0', 'box3', 'box1'], true]
      })
    })

    it('can reorder any stacked mesh', async () => {
      behavior.fromState({ stackIds: ['box2', 'box1', 'box3'] })

      meshes[2].metadata.reorder(['box0', 'box1', 'box2', 'box3'], false)

      expectStack([mesh, meshes[0], meshes[1], meshes[2]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box0', 'box1', 'box2', 'box3'], false]
      })
    })

    it('can move current mesh while reordering', async () => {
      behavior.fromState({ stackIds: ['box3', 'box2', 'box1'] })

      mesh.metadata.reorder(['box3', 'box0', 'box2', 'box1'], false)

      expectStack([meshes[2], mesh, meshes[1], meshes[0]])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box3', 'box0', 'box2', 'box1'], false]
      })
    })

    it('flips the entire stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      await mesh.metadata.flipAll()
      expectStack([meshes[2], meshes[1], meshes[0], mesh])
      expect(recordSpy).toHaveBeenCalledTimes(6)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        fn: 'flipAll',
        meshId: mesh.id
      })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'flip',
        meshId: mesh.id
      })
      expect(recordSpy).toHaveBeenNthCalledWith(3, {
        fn: 'flip',
        meshId: meshes[0].id
      })
      expect(recordSpy).toHaveBeenNthCalledWith(4, {
        fn: 'flip',
        meshId: meshes[1].id
      })
      expect(recordSpy).toHaveBeenNthCalledWith(5, {
        fn: 'flip',
        meshId: meshes[2].id
      })
      expect(recordSpy).toHaveBeenNthCalledWith(6, {
        fn: 'reorder',
        meshId: mesh.id,
        args: [['box3', 'box2', 'box1', 'box0'], false]
      })
    })

    it('flips an entire stack of one', async () => {
      await mesh.metadata.flipAll()
      expectStack([mesh])
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        fn: 'flipAll',
        meshId: mesh.id
      })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'flip',
        meshId: mesh.id
      })
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
      expectStack([meshes[2], meshes[1], meshes[0], mesh])
    })

    it('rotates the entire stack', async () => {
      behavior.fromState({ stackIds: ['box1', 'box2', 'box3'] })

      await mesh.metadata.rotateAll()
      expectStack([mesh, meshes[0], meshes[1], meshes[2]])
      expect(recordSpy).toHaveBeenCalledTimes(4)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        fn: 'rotate',
        meshId: mesh.id
      })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'rotate',
        meshId: meshes[0].id
      })
      expect(recordSpy).toHaveBeenNthCalledWith(3, {
        fn: 'rotate',
        meshId: meshes[1].id
      })
      expect(recordSpy).toHaveBeenNthCalledWith(4, {
        fn: 'rotate',
        meshId: meshes[2].id
      })
    })

    it('rotates an entire stack of one', async () => {
      await mesh.metadata.rotateAll()
      expectStack([mesh])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'rotate',
        meshId: mesh.id
      })
    })
  })
})

function expectStack(meshes) {
  const ids = meshes.slice(1).map(({ id }) => id)
  for (const [rank, mesh] of meshes.entries()) {
    expect(mesh.metadata.stack).toEqual(meshes)
    if (rank === 0) {
      expect(getTargetableBehavior(mesh).state.stackIds).toEqual(ids)
    }
    if (rank === meshes.length - 1) {
      expectInteractible(mesh, true)
    } else {
      expectInteractible(mesh, false)
      expectOnTop(meshes[rank + 1], mesh)
    }
  }
}

function expectZone(behavior, extent, enabled) {
  expect(behavior.zones).toHaveLength(1)
  expect(behavior.zones[0]).toEqual(
    expect.objectContaining({ extent, enabled })
  )
  expect(behavior.zones[0].mesh?.parent?.id).toEqual(behavior.mesh.id)
}

function expectOnTop(meshAbove, meshBelow) {
  expect(meshAbove.absolutePosition.x).toEqual(meshBelow.absolutePosition.x)
  expect(meshAbove.absolutePosition.y).toBeCloseTo(
    getPositionAbove(meshAbove, meshBelow)
  )
  expect(meshAbove.absolutePosition.z).toEqual(meshBelow.absolutePosition.z)
}

function expectInteractible(mesh, isInteractible = true) {
  for (const zone of getTargetableBehavior(mesh).zones) {
    expect(zone.enabled).toBe(isInteractible)
  }
  expect(mesh.getBehaviorByName(MoveBehaviorName).enabled).toBe(isInteractible)
}
