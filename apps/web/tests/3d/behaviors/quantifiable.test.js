// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/behaviors').MoveBehavior} MoveBehavior
 */

import { faker } from '@faker-js/faker'
import {
  MoveBehaviorName,
  QuantityBehavior,
  QuantityBehaviorName
} from '@src/3d/behaviors'
import { controlManager, moveManager, selectionManager } from '@src/3d/managers'
import { createBox, createRoundToken } from '@src/3d/meshes'
import { getTargetableBehavior } from '@src/3d/utils'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

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
  const actionRecorded = vi.fn()
  /** @type {Scene} */
  let scene

  configures3dTestEngine(created => (scene = created.scene))

  beforeAll(() => {
    moveManager.init({ scene })
    controlManager.onActionObservable.add(data => actionRecorded(data))
  })

  beforeEach(() => {
    vi.clearAllMocks()
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
    expect(actionRecorded).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new QuantityBehavior().fromState({ duration: 100 })).toThrow(
      'Can not restore state without mesh'
    )
  })

  it('can hydrate with default state', () => {
    const behavior = new QuantityBehavior()
    const mesh = createBox({ id: 'box0', texture: '' }, scene)
    mesh.addBehavior(behavior, true)

    behavior.fromState()
    expect(behavior.state).toEqual({
      extent: 2,
      duration: 100,
      quantity: 1
    })
    expect(behavior.mesh).toEqual(mesh)
    expect(actionRecorded).not.toHaveBeenCalled()
    expectQuantity(mesh, 1)
  })

  it('can not increment', () => {
    expect(
      new QuantityBehavior().canIncrement?.(
        createBox({ id: 'box1', texture: '' }, scene)
      )
    ).toBe(false)
  })

  describe('given attached to a mesh', () => {
    /** @type {Mesh} */
    let mesh
    /** @type {Mesh[]} */
    let meshes = []
    /** @type {QuantityBehavior} */
    let behavior

    beforeEach(() => {
      ;[mesh, ...meshes] = Array.from({ length: 4 }, (_, rank) =>
        createBox(
          {
            id: `box${rank}`,
            texture: '',
            x: rank,
            y: rank,
            z: rank,
            quantifiable: { duration: 10 },
            movable: {}
          },
          scene
        )
      )
      behavior = /** @type {QuantityBehavior} */ (getTargetableBehavior(mesh))
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
      expect(actionRecorded).not.toHaveBeenCalled()
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
      expect(actionRecorded).not.toHaveBeenCalled()
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
      mesh = createRoundToken(
        { id: 'roundToken', texture: '', diameter },
        scene
      )
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
      expect(actionRecorded).not.toHaveBeenCalled()
      expectNotDisposed(scene, mesh)
    })

    it('increments with meshes', async () => {
      const [other1, other2] = meshes
      expectQuantity(mesh, 1)
      const revert = [
        [other1.metadata.serialize(), other2.metadata.serialize()],
        false
      ]
      await mesh.metadata.increment?.([other1.id, other2.id])
      expectQuantity(mesh, 3)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'increment',
        meshId: mesh.id,
        args: [[other1.id, other2.id], false],
        duration: behavior.state.duration,
        revert,
        fromHand: false,
        isLocal: false
      })
      expectDisposed(scene, other1, other2)
      expectNotDisposed(scene, mesh)
    })

    it('increments with quantifiable meshes', async () => {
      const [other1, other2, other3] = meshes
      other3.getBehaviorByName(QuantityBehaviorName)?.fromState({ quantity: 5 })
      other2.removeBehavior(
        /** @type {QuantityBehavior} */ (
          other2.getBehaviorByName(QuantityBehaviorName)
        )
      )
      other1.getBehaviorByName(QuantityBehaviorName)?.fromState({ quantity: 2 })
      expectQuantity(mesh, 1)
      expectQuantity(other1, 2)
      expectQuantity(other3, 5)
      const revert = [
        [
          other3.metadata.serialize(),
          other2.metadata.serialize(),
          other1.metadata.serialize()
        ],
        false
      ]
      await mesh.metadata.increment?.([other3.id, other2.id, other1.id])
      expectQuantity(mesh, 9)
      expectQuantityIndicator(other1, 0)
      expectQuantityIndicator(other3, 0)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'increment',
        meshId: mesh.id,
        args: [[other3.id, other2.id, other1.id], false],
        duration: behavior.state.duration,
        revert,
        fromHand: false,
        isLocal: false
      })
      expectDisposed(scene, other3, other2, other1)
      expectNotDisposed(scene, mesh)
    })

    it('increments with dropped meshes', async () => {
      const [other1, other2, other3] = meshes
      const revert = [
        [other1.metadata.serialize(), other2.metadata.serialize()],
        false
      ]
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
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'increment',
        meshId: mesh.id,
        args: [[other1.id, other2.id], false],
        duration: behavior.state.duration,
        revert,
        fromHand: false,
        isLocal: false
      })
      expectDisposed(scene, other1, other2)
      expectNotDisposed(scene, mesh, other3)
    })

    it('can revert incremented meshes', async () => {
      const [other1, other2] = meshes
      const position1 = other1.absolutePosition.asArray()
      const position2 = other2.absolutePosition.asArray()
      other2.getBehaviorByName(QuantityBehaviorName)?.fromState({ quantity: 5 })
      other1.removeBehavior(
        /** @type {QuantityBehavior} */ (
          other1.getBehaviorByName(QuantityBehaviorName)
        )
      )
      const state1 = other1.metadata.serialize()
      const state2 = other2.metadata.serialize()
      const revert = [[state2, state1], false]
      await mesh.metadata.increment?.([other2.id, other1.id])
      expectQuantity(mesh, 7)
      expectDisposed(scene, other1, other2)
      expectNotDisposed(scene, mesh)
      actionRecorded.mockClear()

      await behavior.revert('increment', revert)

      const reverted1 = /** @type {Mesh} */ (scene.getMeshById(other1.id))
      const reverted2 = /** @type {Mesh} */ (scene.getMeshById(other2.id))
      expectNotDisposed(scene, mesh, reverted1, reverted2)
      expectQuantity(mesh, 1)
      expectQuantity(reverted2, 5)
      expectPosition(reverted1, position1)
      expectPosition(reverted2, position2)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'decrement',
        meshId: mesh.id,
        duration: behavior.state.duration,
        args: [state2.quantifiable?.quantity ?? 1, false],
        revert: [reverted2.id, false],
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'decrement',
        meshId: mesh.id,
        duration: behavior.state.duration,
        args: [state1.quantifiable?.quantity ?? 1, false],
        revert: [reverted1.id, false],
        fromHand: false,
        isLocal: true
      })
    })

    it('can revert incremented dropped meshes', async () => {
      const [other1, other2, other3] = meshes
      const position1 = other1.absolutePosition.asArray()
      const position2 = other2.absolutePosition.asArray()
      const state1 = other1.metadata.serialize()
      const state2 = other2.metadata.serialize()
      const revert = [[state1, state2], true]
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
      expectDisposed(scene, other1, other2)
      expectNotDisposed(scene, mesh, other3)
      actionRecorded.mockClear()

      await behavior.revert('increment', revert)

      expectNotDisposed(scene, mesh, other1, other2, other3)
      expectQuantity(mesh, 1)
      expectPosition(scene.getMeshById(other1.id), position1)
      expectPosition(scene.getMeshById(other2.id), position2)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'decrement',
        meshId: mesh.id,
        duration: behavior.state.duration,
        args: [state1.quantifiable?.quantity ?? 1, true],
        revert: [other1.id, true],
        fromHand: false,
        isLocal: true
      })
    })

    it('ignores non-incrementable dropped meshes', async () => {
      const [other1, other2, other3] = meshes
      const revert = [[other2.metadata.serialize()], false]
      other1.removeBehavior(
        /** @type {QuantityBehavior} */ (
          other1.getBehaviorByName(QuantityBehaviorName)
        )
      )
      expectQuantity(mesh, 1)
      behavior.onDropObservable.notifyObservers({
        dropped: [other1, other2],
        zone: behavior.zones[0]
      })
      await expectAnimationEnd(other2.getBehaviorByName(MoveBehaviorName))
      expectQuantity(mesh, 2)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'increment',
        meshId: mesh.id,
        args: [[other2.id], false],
        duration: behavior.state.duration,
        revert,
        fromHand: false,
        isLocal: false
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
      expect(actionRecorded).not.toHaveBeenCalled()
      expectNotDisposed(scene, mesh, ...meshes)
    })

    it('can not decrement a quantity of 1', async () => {
      const meshCount = scene.meshes.length
      expectQuantity(mesh, 1)
      expect(await mesh.metadata.decrement?.()).toBeNull()
      expectQuantity(mesh, 1)
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(scene.meshes.length).toBe(meshCount)
    })

    it('creates mesh when decrementing', async () => {
      const quantity = 3
      const meshCount = scene.meshes.length
      behavior.fromState({ quantity })
      expectQuantity(mesh, quantity)

      const created1 = /** @type {Mesh} */ (await mesh.metadata.decrement?.())
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
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'decrement',
        meshId: mesh.id,
        args: [1, false],
        revert: [created1.id, false],
        fromHand: false,
        isLocal: false
      })

      const created2 = /** @type {Mesh} */ (await mesh.metadata.decrement?.())
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
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'decrement',
        meshId: mesh.id,
        args: [1, false],
        revert: [created2.id, false],
        fromHand: false,
        isLocal: false
      })

      expect(await mesh.metadata.decrement?.()).toBeNull()
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(scene.meshes.length).toBe(meshCount + 4)
    })

    it('moves created mesh when decrementing', async () => {
      const quantity = 5
      const meshCount = scene.meshes.length
      behavior.fromState({ quantity })
      expectQuantity(mesh, quantity)

      const created = /** @type {Mesh} */ (
        await mesh.metadata.decrement?.(1, true)
      )
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
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'decrement',
        meshId: mesh.id,
        args: [1, true],
        duration: behavior.state.duration,
        revert: [created.id, true],
        fromHand: false,
        isLocal: false
      })
    })

    it('decrements multiple and moves mesh', async () => {
      const quantity = 4
      const meshCount = scene.meshes.length
      behavior.fromState({ quantity })
      expectQuantity(mesh, quantity)

      const created = /** @type {Mesh} */ (
        await mesh.metadata.decrement?.(2, true)
      )
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
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'decrement',
        meshId: mesh.id,
        args: [2, true],
        duration: behavior.state.duration,
        revert: [created.id, true],
        fromHand: false,
        isLocal: false
      })
    })

    it('decrements when moving mesh', async () => {
      const quantity = 6
      const meshCount = scene.meshes.length
      behavior.fromState({ quantity })
      expectQuantity(mesh, quantity)

      moveManager.start(mesh, { x: 0, y: 0 })
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
      const expectedPosition = [
        mesh.absolutePosition.x,
        0.5,
        mesh.absolutePosition.z
      ]
      expectPosition(created, expectedPosition)
      expectQuantity(mesh, quantity - 1)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'decrement',
        meshId: mesh.id,
        args: [1, false],
        revert: [created.id, false],
        fromHand: false,
        isLocal: false
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        pos: expectedPosition,
        meshId: created.id,
        prev: [0, 0, 0],
        fromHand: false
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

      moveManager.start(mesh, { x: 0, y: 0 })
      await sleep()

      expect(scene.meshes.length).toBe(meshCount)
      expectQuantity(mesh, quantity)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        pos: mesh.absolutePosition.asArray(),
        meshId: mesh.id,
        prev: [0, 0, 0],
        fromHand: false
      })
      expect(moveManager.isMoving(mesh)).toBe(true)
    })

    it('can revert decrement meshes', async () => {
      const quantity = 5
      behavior.fromState({ quantity })
      const created = /** @type {Mesh} */ (await mesh.metadata.decrement?.(2))
      const state = created.metadata.serialize()
      expect(created.id).not.toBe(mesh.id)
      expectPosition(created, mesh.absolutePosition.asArray())

      expectQuantity(mesh, quantity - 2)
      expectQuantity(created, 2)
      actionRecorded.mockClear()

      await behavior.revert('decrement', [created.id, false])

      expectNotDisposed(scene, mesh)
      expectDisposed(scene, created)
      expectQuantity(mesh, quantity)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'increment',
        meshId: mesh.id,
        duration: behavior.state.duration,
        args: [[created.id], false],
        revert: [[state], false],
        fromHand: false,
        isLocal: true
      })
    })

    it('can not increment without mesh', () => {
      // @ts-expect-error no arguments
      expect(mesh.metadata.canIncrement?.()).toBe(false)
      // @ts-expect-error null is not acceptable
      expect(mesh.metadata.canIncrement?.(null)).toBe(false)
    })

    it('can not increment mesh with different kind', () => {
      behavior.fromState({ kinds: ['card'] })
      const moveBehavior = /** @type {MoveBehavior} */ (
        meshes[0].getBehaviorByName(MoveBehaviorName)
      )
      moveBehavior.state.kind = 'token'
      expect(mesh.metadata.canIncrement?.(meshes[0])).toBe(false)
      expect(mesh.metadata.canIncrement?.(meshes[1])).toBe(false)
    })

    it('can increment mesh with the same kind', () => {
      behavior.fromState({ kinds: ['card'] })
      const moveBehavior = /** @type {MoveBehavior} */ (
        meshes[0].getBehaviorByName(MoveBehaviorName)
      )
      moveBehavior.state.kind = 'card'
      expect(mesh.metadata.canIncrement?.(meshes[0])).toBe(true)
    })

    it('can increment mesh with kind on kindless zone', () => {
      const moveBehavior = /** @type {MoveBehavior} */ (
        meshes[0].getBehaviorByName(MoveBehaviorName)
      )
      moveBehavior.state.kind = 'card'
      expect(mesh.metadata.canIncrement?.(meshes[0])).toBe(true)
    })

    it('can not increment with non quantifiable mesh', async () => {
      meshes[2].removeBehavior(
        /** @type {QuantityBehavior} */ (
          meshes[2].getBehaviorByName(QuantityBehaviorName)
        )
      )
      expect(mesh.metadata.canIncrement?.(meshes[2])).toBe(false)
    })
  })
})

function expectQuantity(
  /** @type {Mesh} */ mesh,
  /** @type {number} */ quantity
) {
  expect(mesh.metadata?.quantity).toBe(quantity)
  expectQuantityIndicator(mesh, quantity)
}
