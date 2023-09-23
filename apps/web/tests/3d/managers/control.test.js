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
import { AnchorBehavior, FlipBehavior, MoveBehavior } from '@src/3d/behaviors'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { configures3dTestEngine, createBox } from '../../test-utils'

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
  /** @type {SpyInstance<Parameters<AnchorBehavior['revert']>, Promise<void>>} */
  let revertSpy
  const controlledChangeReceived = vi.fn()
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  /** @type {import('@src/3d/managers').ControlManager} */
  let manager
  /** @type {string} */
  let playerId

  configures3dTestEngine(
    created => {
      scene = created.scene
      handScene = created.handScene
      managers = created.managers
      playerId = created.playerId
      manager = managers.control
      managers.hand.enabled = true
      manager.onActionObservable.add(action => actions.push(action))
      manager.onControlledObservable.add(controlledChangeReceived)
    },
    { isSimulation: globalThis.use3dSimulation }
  )

  beforeEach(() => {
    vi.clearAllMocks()
    actions = []

    mesh = createBox('box1', {}, scene)
    mesh.addBehavior(new MoveBehavior({}, managers), true)
    anchorable = createBox('box2', {})
    const anchorableBehavior = new AnchorBehavior(
      {
        anchors: [{ id: 'anchor-0', width: 1, height: 1, depth: 0.5 }]
      },
      managers
    )
    anchorable.addBehavior(anchorableBehavior, true)
    anchorable.addBehavior(new FlipBehavior({}, managers), true)
    handMesh = createBox('hand-box', {}, handScene)
    handMesh.addBehavior(new MoveBehavior({}, managers), true)
    snapSpy = vi.spyOn(anchorable.metadata, 'snap')
    flipSpy = vi.spyOn(anchorable.metadata, 'flip')
    revertSpy = vi.spyOn(anchorableBehavior, 'revert')

    manager.registerControlable(mesh)
    manager.registerControlable(handMesh)
    manager.registerControlable(anchorable)
    controlledChangeReceived.mockReset()
  })

  describe('registerControlable()', () => {
    it('registers a mesh', () => {
      const mesh = createBox('box3', {})
      expect(manager.isManaging(mesh)).toBe(false)

      manager.registerControlable(mesh)
      expect(manager.isManaging(mesh)).toBe(true)
      expect(controlledChangeReceived).toHaveBeenCalledOnce()
      expect(controlledChangeReceived.mock.calls[0][0].has(mesh.id)).toBe(true)
    })

    it('automatically unregisters a mesh upon disposal', () => {
      const mesh = createBox('box4', {})
      manager.registerControlable(mesh)
      expect(manager.isManaging(mesh)).toBe(true)
      expect(controlledChangeReceived).toHaveBeenCalledOnce()
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
      expect(controlledChangeReceived).toHaveBeenCalledOnce()
      expect(controlledChangeReceived.mock.calls[0][0].has(mesh.id)).toBe(true)
    })
  })

  describe('unregisterControlable()', () => {
    it('ignores uncontrolled mesh', () => {
      const mesh = createBox('box6', {})
      expect(manager.isManaging(mesh)).toBe(false)

      manager.unregisterControlable(mesh)
      expect(manager.isManaging(mesh)).toBe(false)
      expect(controlledChangeReceived).not.toHaveBeenCalled()
    })
  })

  describe('apply()', () => {
    it('ignores uncontrolled mesh', async () => {
      const mesh = createBox('box', {})
      mesh.addBehavior(new FlipBehavior({}, managers), true)
      const flipSpy = vi.spyOn(mesh.metadata, 'flip')

      await manager.apply({ meshId: mesh.id, fn: 'flip', args: [] })
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
      expect(controlledChangeReceived).not.toHaveBeenCalled()
    })

    it('applies an action', async () => {
      const args = [mesh.id, 'anchor-0', false]
      await manager.apply({ meshId: anchorable.id, fn: 'snap', args })
      expect(snapSpy).toHaveBeenCalledOnce()
      expect(snapSpy).toHaveBeenCalledWith(...args)
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(1)
      expect(actions[0]).toEqual({
        meshId: anchorable.id,
        fn: 'snap',
        args,
        revert: ['box1', [0, 0, 0], undefined, undefined],
        fromHand: false,
        isLocal: true,
        duration: 100
      })
    })

    it('applies play action', async () => {
      const meshId = 'another-box'
      const state = { id: meshId, shape: 'box', texture: '' }
      const playerId = 'player-id-2'
      await manager.apply({ meshId, fn: 'play', args: [state, playerId] })
      expect(actions).toHaveLength(1)
      expect(actions[0]).toEqual({
        meshId: meshId,
        fn: 'play',
        args: [expect.objectContaining(state), playerId],
        fromHand: false,
        isLocal: true
      })
    })

    it('applies an action without arguments', async () => {
      await manager.apply({
        meshId: anchorable.id,
        fn: 'flip',
        args: []
      })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).toHaveBeenCalledOnce()
      expect(actions).toHaveLength(1)
      expect(actions[0]).toEqual({
        meshId: anchorable.id,
        fn: 'flip',
        fromHand: false,
        isLocal: true,
        args: [],
        duration: 500
      })
    })

    it('applies a move', async () => {
      const pos = [
        faker.number.int(999),
        faker.number.int(999),
        faker.number.int(999)
      ]
      const prev = [
        faker.number.int(999),
        faker.number.int(999),
        faker.number.int(999)
      ]
      await manager.apply({ meshId: mesh.id, pos, prev })
      expect(mesh.absolutePosition.asArray()).toEqual(pos)
      expect(actions).toHaveLength(0)
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
    })

    it('handles unsupported messages', async () => {
      // @ts-expect-error --parameter is not a valid action
      await manager.apply({ meshId: mesh.id, position: [3, 3, 3] })
      expect(mesh.absolutePosition.asArray()).toEqual([0, 0, 0])
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })

    it('handles unsupported action', async () => {
      await manager.apply({ meshId: anchorable.id, fn: 'rotate', args: [] })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })

    it('handles mesh without metadata', async () => {
      await manager.apply({ meshId: mesh.id, fn: 'snap', args: [] })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })

    it('stops applying on unregistered meshes', async () => {
      expect(manager.isManaging(anchorable)).toBe(true)

      manager.unregisterControlable(anchorable)
      expect(manager.isManaging(anchorable)).toBe(false)
      await manager.apply({
        meshId: anchorable.id,
        fn: 'snap',
        args: [mesh.id, 'anchor-0']
      })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })
  })

  describe('record()', () => {
    it('ignores uncontrolled mesh', async () => {
      const mesh = createBox('box4', {})
      await manager.record({ mesh, fn: 'flip', args: [] })
      expect(actions).toHaveLength(0)
    })

    it('handled unsupported messages', async () => {
      // @ts-expect-error
      manager.record({})
      // @ts-expect-error
      await manager.record({ id: 'box', fn: 'flip' })
      expect(actions).toHaveLength(0)
    })

    it('distunguishes action from main and hand scenes', async () => {
      await manager.record({ mesh, fn: 'flip', args: [] })
      await manager.record({ mesh: handMesh, fn: 'rotate', args: [] })
      await manager.record({ mesh: handMesh, fn: 'draw', args: [] })
      await manager.record({ mesh, fn: 'draw', args: [] })
      expect(actions).toEqual([
        {
          meshId: mesh.id,
          fn: 'flip',
          fromHand: false,
          args: [],
          isLocal: false
        },
        {
          meshId: handMesh.id,
          fn: 'rotate',
          fromHand: true,
          args: [],
          isLocal: false
        },
        {
          meshId: handMesh.id,
          fn: 'draw',
          fromHand: true,
          args: [],
          isLocal: false
        },
        {
          meshId: mesh.id,
          fn: 'draw',
          fromHand: false,
          args: [],
          isLocal: false
        }
      ])
    })

    it('relays action locality', async () => {
      await manager.record({ mesh, fn: 'flip', args: [], isLocal: true })
      expect(actions).toEqual([
        {
          meshId: mesh.id,
          fn: 'flip',
          fromHand: false,
          args: [],
          isLocal: true
        }
      ])
    })

    it('only relays moves', async () => {
      const position = mesh.absolutePosition.asArray()
      await manager.record({ mesh, pos: [2, 2, 2], prev: [3, 3, 3] })
      expect(actions).toEqual([
        {
          meshId: mesh.id,
          pos: [2, 2, 2],
          prev: [3, 3, 3],
          fromHand: false
        }
      ])
      expect(mesh.absolutePosition.asArray()).toEqual(position)
    })
  })

  describe('invokeLocal()', () => {
    it('ignores uncontrolled mesh', async () => {
      const mesh = createBox('box4', {})
      await manager.invokeLocal(mesh, 'flip')
      expect(actions).toHaveLength(0)
    })

    it('invokes an action', async () => {
      await manager.invokeLocal(anchorable, 'flip')
      expect(flipSpy).toHaveBeenCalledOnce()
      expect(actions).toEqual([
        {
          meshId: anchorable.id,
          fn: 'flip',
          args: [],
          duration: 500,
          fromHand: false,
          isLocal: true
        }
      ])
    })

    it('handles unsupported action', async () => {
      await manager.invokeLocal(mesh, 'flip')
      expect(actions).toHaveLength(0)
    })
  })

  describe('revert()', () => {
    it('ignores uncontrolled mesh', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => void 0)
      const mesh = createBox('box4', {})
      await manager.revert({ meshId: mesh.id, fn: 'flip', args: [] })
      expect(actions).toHaveLength(0)
    })

    it('reverts an action', async () => {
      await manager.revert({ meshId: anchorable.id, fn: 'flip', args: [] })
      expect(revertSpy).toHaveBeenCalledOnce()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toEqual([
        {
          meshId: anchorable.id,
          fn: 'flip',
          args: [],
          duration: 500,
          fromHand: false,
          isLocal: true
        }
      ])
    })

    it('reverts draw action', async () => {
      const meshId = 'another-mesh'
      const state = { id: meshId, shape: 'box', texture: '' }
      await manager.revert({ meshId, fn: 'draw', args: [state, playerId] })
      expect(actions).toEqual([
        {
          meshId,
          fn: 'play',
          args: [expect.objectContaining(state), playerId],
          fromHand: false,
          isLocal: true
        }
      ])
    })

    it('reverts a move', async () => {
      const pos = [
        faker.number.int(999),
        faker.number.int(999),
        faker.number.int(999)
      ]
      const prev = [
        faker.number.int(999),
        faker.number.int(999),
        faker.number.int(999)
      ]
      await manager.revert({ meshId: mesh.id, pos, prev })
      expect(mesh.absolutePosition.asArray()).toEqual(prev)
      expect(actions).toHaveLength(0)
    })

    it('handles unsupported action', async () => {
      await manager.revert({
        meshId: anchorable.id,
        // @ts-expect-error -- this is not a valid action
        fn: 'unsupported',
        args: []
      })
      expect(revertSpy).toHaveBeenCalledOnce()
      expect(actions).toHaveLength(0)
    })
  })
})
