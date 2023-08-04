// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/managers/control').Action} Action
 * @typedef {import('@src/3d/managers/control').Move} Move
 */
/**
 * @template {any[]} P, R
 * @typedef {import('vitest').SpyInstance<P, R>} SpyInstance
 */

import { faker } from '@faker-js/faker'
import { AnchorBehavior, FlipBehavior } from '@src/3d/behaviors'
import { controlManager as manager, indicatorManager } from '@src/3d/managers'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { configures3dTestEngine, createBox, sleep } from '../../test-utils'

describe('ControlManager', () => {
  /** @type {Scene} */
  let scene
  /** @type {Scene} */
  let handScene
  /** @type {(Action|Move)[]} */
  let actions
  /** @type {Mesh} */
  let mesh
  /** @type {Mesh} */
  let handMesh
  /** @type {Mesh} */
  let anchorable
  /** @type {SpyInstance<Parameters<AnchorBehavior['snap']>, Promise<void>>} */
  let snapSpy
  /** @type {SpyInstance<Parameters<FlipBehavior['flip']>, Promise<void>>} */
  let flipSpy
  const controlledChangeReceived = vi.fn()

  configures3dTestEngine(created => ({ scene, handScene } = created))

  beforeAll(() => {
    indicatorManager.init({ scene })
    manager.onActionObservable.add(action => actions.push(action))
    manager.onControlledObservable.add(controlledChangeReceived)
  })

  beforeEach(() => {
    vi.resetAllMocks()
    actions = []

    mesh = createBox('box1', {}, scene)
    anchorable = createBox('box2', {})
    anchorable.addBehavior(
      new AnchorBehavior({
        anchors: [{ id: '1', width: 1, height: 1, depth: 0.5 }]
      }),
      true
    )
    anchorable.addBehavior(new FlipBehavior(), true)
    handMesh = createBox('box3', {}, handScene)
    snapSpy = vi.spyOn(anchorable.metadata, 'snap')
    flipSpy = vi.spyOn(anchorable.metadata, 'flip')

    manager.registerControlable(mesh)
    manager.registerControlable(anchorable)
    manager.init({ scene, handScene })
    controlledChangeReceived.mockReset()
  })

  describe('registerControlable()', () => {
    it('registers a mesh', () => {
      const mesh = createBox('box3', {})
      expect(manager.isManaging(mesh)).toBe(false)

      manager.registerControlable(mesh)
      expect(manager.isManaging(mesh)).toBe(true)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(1)
      expect(controlledChangeReceived.mock.calls[0][0].has(mesh.id)).toBe(true)
    })

    it('automatically unregisters a mesh upon disposal', () => {
      const mesh = createBox('box4', {})
      manager.registerControlable(mesh)
      expect(manager.isManaging(mesh)).toBe(true)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(1)
      expect(controlledChangeReceived.mock.calls[0][0].has(mesh.id)).toBe(true)

      mesh.dispose()
      expect(manager.isManaging(mesh)).toBe(false)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(2)
      expect(controlledChangeReceived.mock.calls[1][0].has(mesh.id)).toBe(false)
    })

    it('does not unregisters a phantom mesh', () => {
      const mesh = createBox('box5', {})
      manager.registerControlable(mesh)
      mesh.isPhantom = true
      expect(manager.isManaging(mesh)).toBe(true)

      mesh.dispose()
      expect(manager.isManaging(mesh)).toBe(true)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(1)
      expect(controlledChangeReceived.mock.calls[0][0].has(mesh.id)).toBe(true)
    })
  })

  describe('unregisterControlable()', () => {
    it('ignores uncontrolled mesh', () => {
      const mesh = createBox('box6', {})
      expect(manager.isManaging(mesh)).toBe(false)

      manager.unregisterControlable(mesh)
      expect(manager.isManaging(mesh)).toBe(false)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(0)
    })
  })

  describe('apply()', () => {
    it('ignores uncontrolled mesh', () => {
      const mesh = createBox('box', {})
      mesh.addBehavior(new FlipBehavior(), true)
      const flipSpy = vi.spyOn(mesh.metadata, 'flip')

      manager.apply({
        meshId: mesh.id,
        fn: 'flip',
        args: [],
        fromHand: false,
        pos: undefined
      })
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(0)
    })

    it('applies an action', async () => {
      const args = [mesh.id, 'anchor-0', false]
      manager.apply({
        meshId: anchorable.id,
        fn: 'snap',
        args,
        fromHand: false,
        pos: undefined
      })
      expect(snapSpy).toHaveBeenCalledTimes(1)
      expect(snapSpy).toHaveBeenCalledWith(...args)
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(1)
      expect(actions[0]).toEqual({
        meshId: anchorable.id,
        fn: 'snap',
        args,
        fromHand: false,
        duration: 100
      })
      await sleep()
      expect(controlledChangeReceived).toHaveBeenCalledTimes(2)
      expect(controlledChangeReceived.mock.calls[0][0].has(mesh.id)).toBe(true)
    })

    it('applies an action without arguments', () => {
      manager.apply({
        meshId: anchorable.id,
        fn: 'flip',
        args: [],
        fromHand: false,
        pos: undefined
      })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).toHaveBeenCalledTimes(1)
      expect(actions).toHaveLength(1)
      expect(actions[0]).toEqual({
        meshId: anchorable.id,
        fn: 'flip',
        fromHand: false,
        args: [],
        duration: 500
      })
    })

    it('applies an action without recording it', () => {
      const args = [mesh.id, 'anchor-0', false]
      manager.apply(
        {
          meshId: anchorable.id,
          fn: 'snap',
          args,
          fromHand: false,
          pos: undefined
        },
        true
      )
      expect(snapSpy).toHaveBeenCalledTimes(1)
      expect(snapSpy).toHaveBeenCalledWith(...args)
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })

    it('applies a move', async () => {
      const pos = [
        faker.number.int(999),
        faker.number.int(999),
        faker.number.int(999)
      ]
      manager.apply({
        meshId: mesh.id,
        pos,
        fn: undefined,
        args: undefined,
        fromHand: false
      })
      expect(mesh.absolutePosition.asArray()).toEqual(pos)
      expect(actions).toHaveLength(0)
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      await sleep()
      expect(controlledChangeReceived).toHaveBeenCalledTimes(1)
      expect(controlledChangeReceived.mock.calls[0][0].has(mesh.id)).toBe(true)
    })

    it('handles unsupported messages', async () => {
      // @ts-expect-error
      manager.apply({ meshId: mesh.id, position: [3, 3, 3] })
      expect(mesh.absolutePosition.asArray()).toEqual([0, 0, 0])
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
      await sleep()
      expect(controlledChangeReceived).toHaveBeenCalledTimes(1)
    })

    it('handles unsupported action', async () => {
      manager.apply({
        meshId: anchorable.id,
        fn: 'rotate',
        args: [],
        pos: undefined,
        fromHand: false
      })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
      await sleep()
      expect(controlledChangeReceived).toHaveBeenCalledTimes(1)
    })

    it('handles mesh without metadata', () => {
      manager.apply({
        meshId: mesh.id,
        fn: 'snap',
        args: [],
        fromHand: false,
        pos: undefined
      })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })

    it('stops applying on unregistered meshes', () => {
      expect(manager.isManaging(anchorable)).toBe(true)

      manager.unregisterControlable(anchorable)
      expect(manager.isManaging(anchorable)).toBe(false)
      manager.apply({
        meshId: anchorable.id,
        fn: 'snap',
        args: [mesh.id, 'anchor-0'],
        fromHand: false,
        pos: undefined
      })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })
  })

  describe('record()', () => {
    it('ignores uncontrolled mesh', async () => {
      const mesh = createBox('box4', {})
      manager.record({
        mesh,
        fn: 'flip',
        args: [],
        pos: undefined
      })
      expect(actions).toHaveLength(0)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(0)
    })

    it('handled unsupported messages', async () => {
      // @ts-expect-error
      manager.record({})
      // @ts-expect-error
      manager.record({ id: 'box', fn: 'flip' })
      expect(actions).toHaveLength(0)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(0)
    })

    it('distunguishes action from main and hand scenes', () => {
      manager.registerControlable(mesh)
      manager.registerControlable(handMesh)
      manager.record({ mesh, fn: 'flip', args: [], pos: undefined })
      manager.record({ mesh: handMesh, fn: 'rotate', args: [], pos: undefined })
      manager.record({ mesh: handMesh, fn: 'draw', args: [], pos: undefined })
      manager.record({ mesh, fn: 'draw', args: [], pos: undefined })
      expect(actions).toEqual([
        { meshId: mesh.id, fn: 'flip', fromHand: false, args: [] },
        { meshId: handMesh.id, fn: 'rotate', fromHand: true, args: [] },
        { meshId: handMesh.id, fn: 'draw', fromHand: false, args: [] },
        { meshId: mesh.id, fn: 'draw', fromHand: false, args: [] }
      ])
    })
  })
})
