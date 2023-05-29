import { faker } from '@faker-js/faker'
import {
  MoveBehaviorName,
  QuantityBehavior,
  QuantityBehaviorName
} from '@src/3d/behaviors'
import { controlManager, moveManager, selectionManager } from '@src/3d/managers'
import { createBox, createRoundToken } from '@src/3d/meshes'
import { getTargetableBehavior } from '@src/3d/utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  configures3dTestEngine,
  expectAnimationEnd,
  expectDisposed,
  expectNotDisposed,
  expectPosition,
  expectQuantityIndicator,
  expectZone,
  sleep
} from '../../test-utils'

describe('QuantityBehavior', () => {
  let scene
  let recordSpy

  configures3dTestEngine(created => (scene = created.scene))

  beforeEach(() => {
    vi.clearAllMocks()
    recordSpy = vi.spyOn(controlManager, 'record')
  })

  it('has initial state', () => {
    const state = {
      extent: faker.number.int(999),
      duration: faker.number.int(999),
      kinds: [],
      quantity: faker.number.int(999)
    }
    const behavior = new QuantityBehavior(state)

    expect(behavior.name).toEqual(QuantityBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.mesh).toBeNull()
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new QuantityBehavior().fromState({ duration: 100 })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can hydrate with default state', () => {
    const behavior = new QuantityBehavior()
    const mesh = createBox({ id: 'box0' })
    mesh.addBehavior(behavior, true)

    behavior.fromState()
    expect(behavior.state).toEqual({
      extent: 2,
      duration: 100,
      quantity: 1
    })
    expect(behavior.mesh).toEqual(mesh)
    expect(recordSpy).not.toHaveBeenCalled()
    expectQuantity(mesh, 1)
  })

  it('can not increment', () => {
    expect(new QuantityBehavior().canIncrement(createBox({ id: 'box1' }))).toBe(
      false
    )
  })

  describe('given attached to a mesh', () => {
    let mesh
    let meshes = []
    let behavior

    beforeEach(() => {
      ;[mesh, ...meshes] = Array.from({ length: 4 }, (_, rank) =>
        createBox({
          id: `box${rank}`,
          x: rank,
          y: rank,
          z: rank,
          quantifiable: { duration: 10 },
          movable: {}
        })
      )
      behavior = getTargetableBehavior(mesh)
    })

    afterEach(() => moveManager.stop())

    it('attaches metadata to its mesh', () => {
      expectQuantity(mesh, 1)
      expectZone(behavior, { extent: 2, enabled: true })
      expect(behavior.state.duration).toEqual(10)
      expect(behavior.state.extent).toEqual(2)
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          quantity: 1,
          increment: expect.any(Function),
          decrement: expect.any(Function),
          canIncrement: expect.any(Function)
        })
      )
      expect(recordSpy).not.toHaveBeenCalled()
      expectNotDisposed(scene, mesh)
    })

    it('can hydrate from state', async () => {
      const extent = faker.number.int(999)
      const quantity = faker.number.int({ min: 2, max: 100 })
      const duration = faker.number.int(999)
      const kinds = ['card']
      const priority = faker.number.int(999)

      behavior.fromState({ duration, extent, quantity, kinds, priority })
      expectQuantity(mesh, quantity)
      expectZone(behavior, { extent, enabled: true, kinds, priority })
      expect(behavior.state.duration).toEqual(duration)
      expect(behavior.state.extent).toEqual(extent)
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          quantity,
          increment: expect.any(Function),
          decrement: expect.any(Function),
          canIncrement: expect.any(Function)
        })
      )
      expect(recordSpy).not.toHaveBeenCalled()
      expectNotDisposed(scene, mesh)
    })

    it('can hydrate with cylindric zone', async () => {
      const extent = faker.number.int(999)
      const duration = faker.number.int(999)
      const quantity = faker.number.int({ min: 2, max: 100 })
      const kinds = ['tokens']
      const priority = faker.number.int(999)
      const diameter = 5
      mesh.removeBehavior(behavior)
      mesh = createRoundToken({ id: 'roundToken', diameter })
      mesh.addBehavior(behavior, true)

      behavior.fromState({ duration, extent, quantity, kinds, priority })
      expectQuantity(mesh, quantity)
      expectZone(behavior, { extent, enabled: true, kinds, priority })
      const { boundingBox } = behavior.zones[0].mesh.getBoundingInfo()
      expect(boundingBox.extendSize.x * 2).toBeCloseTo(diameter)
      expect(boundingBox.extendSize.z * 2).toBeCloseTo(diameter)
      expect(behavior.state.duration).toEqual(duration)
      expect(behavior.state.extent).toEqual(extent)
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          quantity,
          increment: expect.any(Function),
          decrement: expect.any(Function)
        })
      )
      expect(recordSpy).not.toHaveBeenCalled()
      expectNotDisposed(scene, mesh)
    })

    it('increments with meshes', async () => {
      const [other1, other2] = meshes
      expectQuantity(mesh, 1)
      await mesh.metadata.increment([other1.id, other2.id])
      expectQuantity(mesh, 3)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'increment',
        mesh,
        args: [[other1.id, other2.id], false],
        duration: behavior.state.duration
      })
      expectDisposed(scene, other1, other2)
      expectNotDisposed(scene, mesh)
    })

    it('increments with quantifiable meshes', async () => {
      const [other1, other2, other3] = meshes
      other3.getBehaviorByName(QuantityBehaviorName).fromState({ quantity: 5 })
      other2.removeBehavior(other2.getBehaviorByName(QuantityBehaviorName))
      other1.getBehaviorByName(QuantityBehaviorName).fromState({ quantity: 2 })
      expectQuantity(mesh, 1)
      expectQuantity(other1, 2)
      expectQuantity(other3, 5)
      await mesh.metadata.increment([other3.id, other2.id, other1.id])
      expectQuantity(mesh, 9)
      expectQuantityIndicator(other1, 0)
      expectQuantityIndicator(other3, 0)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'increment',
        mesh,
        args: [[other3.id, other2.id, other1.id], false],
        duration: behavior.state.duration
      })
      expectDisposed(scene, other3, other2, other1)
      expectNotDisposed(scene, mesh)
    })

    it('increments with dropped meshes', async () => {
      const [other1, other2, other3] = meshes
      expectQuantity(mesh, 1)
      behavior.onDropObservable.notifyObservers({
        dropped: [other1, other2],
        zone: behavior.zones[0]
      })
      await Promise.all([
        expectAnimationEnd(other1.getBehaviorByName(MoveBehaviorName)),
        expectAnimationEnd(other2.getBehaviorByName(MoveBehaviorName))
      ])
      expectQuantity(mesh, 3)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'increment',
        mesh,
        args: [[other1.id, other2.id], false],
        duration: behavior.state.duration
      })
      expectDisposed(scene, other1, other2)
      expectNotDisposed(scene, mesh, other3)
    })

    it('ignores non-incrementable dropped meshes', async () => {
      const [other1, other2, other3] = meshes
      other1.removeBehavior(other1.getBehaviorByName(QuantityBehaviorName))
      expectQuantity(mesh, 1)
      behavior.onDropObservable.notifyObservers({
        dropped: [other1, other2],
        zone: behavior.zones[0]
      })
      await expectAnimationEnd(other2.getBehaviorByName(MoveBehaviorName))
      expectQuantity(mesh, 2)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'increment',
        mesh,
        args: [[other2.id], false],
        duration: behavior.state.duration
      })
      await sleep()
      expectDisposed(scene, other2)
      expectNotDisposed(scene, mesh, other1, other3)
    })

    it('ignores empty drops', async () => {
      expectQuantity(mesh, 1)
      behavior.onDropObservable.notifyObservers({
        dropped: [],
        zone: behavior.zones[0]
      })
      expectQuantity(mesh, 1)
      expect(recordSpy).not.toHaveBeenCalled()
      expectNotDisposed(scene, mesh, ...meshes)
    })

    it('can not decrement a quantity of 1', async () => {
      const meshCount = scene.meshes.length
      expectQuantity(mesh, 1)
      expect(await mesh.metadata.decrement()).toBeNull()
      expectQuantity(mesh, 1)
      expect(recordSpy).not.toHaveBeenCalled()
      expect(scene.meshes.length).toBe(meshCount)
    })

    it('creates mesh when decrementing', async () => {
      const quantity = 3
      const meshCount = scene.meshes.length
      behavior.fromState({ quantity })
      expectQuantity(mesh, quantity)

      const created1 = await mesh.metadata.decrement()
      expect(created1.id).not.toBe(mesh.id)
      expectPosition(created1, mesh.absolutePosition.asArray())
      expect(created1.metadata.serialize()).toMatchObject({
        id: expect.stringMatching(/^box0-/),
        shape: 'box',
        movable: { snapDistance: 0.25, duration: 100 },
        quantifiable: { ...behavior.state, quantity: 1 }
      })
      expect(scene.meshes.length).toBe(meshCount + 2)
      expectQuantity(mesh, quantity - 1)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        fn: 'decrement',
        mesh,
        args: [1, false]
      })

      const created2 = await mesh.metadata.decrement()
      expect(created2.id).not.toBe(mesh.id)
      expect(created2.id).not.toBe(created1.id)
      expectPosition(created2, mesh.absolutePosition.asArray())
      expect(created2.metadata.serialize()).toMatchObject({
        id: expect.stringMatching(/^box0-/),
        shape: 'box',
        movable: { snapDistance: 0.25, duration: 100 },
        quantifiable: { ...behavior.state, quantity: 1 }
      })
      expect(scene.meshes.length).toBe(meshCount + 4)
      expectQuantity(mesh, quantity - 2)
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'decrement',
        mesh,
        args: [1, false]
      })

      expect(await mesh.metadata.decrement()).toBeNull()
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(scene.meshes.length).toBe(meshCount + 4)
    })

    it('moves created mesh when decrementing', async () => {
      const quantity = 5
      const meshCount = scene.meshes.length
      behavior.fromState({ quantity })
      expectQuantity(mesh, quantity)

      const created = await mesh.metadata.decrement(1, true)
      expect(created.id).not.toBe(mesh.id)
      const [x, y, z] = mesh.absolutePosition.asArray()
      expectPosition(created, [x + 1, y + 0.5, z])
      expect(created.metadata.serialize()).toMatchObject({
        id: expect.stringMatching(/^box0-/),
        shape: 'box',
        movable: { snapDistance: 0.25, duration: 100 },
        quantifiable: { ...behavior.state, quantity: 1 }
      })
      expect(scene.meshes.length).toBe(meshCount + 2)
      expectQuantity(mesh, quantity - 1)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'decrement',
        mesh,
        args: [1, true],
        duration: behavior.state.duration
      })
    })

    it('decrements multiple and moves mesh', async () => {
      const quantity = 4
      const meshCount = scene.meshes.length
      behavior.fromState({ quantity })
      expectQuantity(mesh, quantity)

      const created = await mesh.metadata.decrement(2, true)
      expect(created.id).not.toBe(mesh.id)
      const [x, y, z] = mesh.absolutePosition.asArray()
      expectPosition(created, [x + 1, y + 0.5, z])
      expect(created.metadata.serialize()).toMatchObject({
        id: expect.stringMatching(/^box0-/),
        shape: 'box',
        movable: { snapDistance: 0.25, duration: 100 },
        quantifiable: { ...behavior.state, quantity: 2 }
      })
      expect(scene.meshes.length).toBe(meshCount + 2)
      expectQuantity(mesh, quantity - 2)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'decrement',
        mesh,
        args: [2, true],
        duration: behavior.state.duration
      })
    })

    it('decrements when moving mesh', async () => {
      const quantity = 6
      const meshCount = scene.meshes.length
      behavior.fromState({ quantity })
      expectQuantity(mesh, quantity)

      moveManager.start(mesh, {})
      await sleep()

      expect(scene.meshes.length).toBe(meshCount + 2)
      const created = scene.meshes[meshCount]
      expect(created.id).not.toBe(mesh.id)
      expect(created.metadata.serialize()).toMatchObject({
        id: expect.stringMatching(/^box0-/),
        shape: 'box',
        movable: { snapDistance: 0.25, duration: 100 },
        quantifiable: { ...behavior.state, quantity: 1 }
      })
      expectPosition(created, mesh.absolutePosition.asArray())
      expectQuantity(mesh, quantity - 1)
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        fn: 'decrement',
        mesh,
        args: [1, false]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        pos: mesh.absolutePosition.asArray(),
        mesh: created
      })
      expect(moveManager.isMoving(mesh)).toBe(false)
      expect(moveManager.isMoving(created)).toBe(true)
    })

    it('does not decrement when moving selected mesh', async () => {
      const quantity = 6
      const meshCount = scene.meshes.length
      behavior.fromState({ quantity })
      expectQuantity(mesh, quantity)
      selectionManager.select(mesh)

      moveManager.start(mesh, {})
      await sleep()

      expect(scene.meshes.length).toBe(meshCount)
      expectQuantity(mesh, quantity)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        pos: mesh.absolutePosition.asArray(),
        mesh
      })
      expect(moveManager.isMoving(mesh)).toBe(true)
    })

    it('can not increment without mesh', () => {
      expect(mesh.metadata.canIncrement()).toBe(false)
      expect(mesh.metadata.canIncrement(null)).toBe(false)
    })

    it('can not increment mesh with different kind', () => {
      behavior.fromState({ kinds: ['card'] })
      meshes[0].getBehaviorByName(MoveBehaviorName).state.kind = 'token'
      expect(mesh.metadata.canIncrement(meshes[0])).toBe(false)
      expect(mesh.metadata.canIncrement(meshes[1])).toBe(false)
    })

    it('can increment mesh with the same kind', () => {
      behavior.fromState({ kinds: ['card'] })
      meshes[0].getBehaviorByName(MoveBehaviorName).state.kind = 'card'
      expect(mesh.metadata.canIncrement(meshes[0])).toBe(true)
    })

    it('can increment mesh with kind on kindless zone', () => {
      meshes[0].getBehaviorByName(MoveBehaviorName).state.kind = 'card'
      expect(mesh.metadata.canIncrement(meshes[0])).toBe(true)
    })

    it('can not increment with non quantifiable mesh', async () => {
      meshes[2].removeBehavior(
        meshes[2].getBehaviorByName(QuantityBehaviorName)
      )
      expect(mesh.metadata.canIncrement(meshes[2])).toBe(false)
    })
  })
})

function expectQuantity(mesh, quantity) {
  expect(mesh.metadata?.quantity).toBe(quantity)
  expectQuantityIndicator(mesh, quantity)
}
