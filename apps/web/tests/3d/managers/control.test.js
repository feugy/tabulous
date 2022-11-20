import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { faker } from '@faker-js/faker'
import { AnchorBehavior, FlipBehavior } from '@src/3d/behaviors'
import { controlManager as manager, indicatorManager } from '@src/3d/managers'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { configures3dTestEngine, sleep } from '../../test-utils'

describe('ControlManager', () => {
  let scene
  let handScene
  let actions
  let mesh
  let handMesh
  let anchorable
  let snapSpy
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

    mesh = CreateBox('box1', {}, scene)
    anchorable = CreateBox('box2', {})
    anchorable.addBehavior(
      new AnchorBehavior({
        anchors: [{ width: 1, height: 1, depth: 0.5 }]
      }),
      true
    )
    anchorable.addBehavior(new FlipBehavior(), true)
    handMesh = CreateBox('box3', {}, handScene)
    snapSpy = vi.spyOn(anchorable.metadata, 'snap')
    flipSpy = vi.spyOn(anchorable.metadata, 'flip')

    manager.registerControlable(mesh)
    manager.registerControlable(anchorable)
    manager.init({ scene, handScene })
    controlledChangeReceived.mockReset()
  })

  describe('registerControlable()', () => {
    it('registers a mesh', () => {
      const mesh = CreateBox('box3', {})
      expect(manager.isManaging(mesh)).toBe(false)

      manager.registerControlable(mesh)
      expect(manager.isManaging(mesh)).toBe(true)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(1)
      expect(controlledChangeReceived.mock.calls[0][0].has(mesh.id)).toBe(true)
    })

    it('automatically unregisters a mesh upon disposal', () => {
      const mesh = CreateBox('box4', {})
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
      const mesh = CreateBox('box5', {})
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
      const mesh = CreateBox('box6', {})
      expect(manager.isManaging(mesh)).toBe(false)

      manager.unregisterControlable(mesh)
      expect(manager.isManaging(mesh)).toBe(false)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(0)
    })
  })

  describe('apply()', () => {
    it('ignores uncontrolled mesh', () => {
      const mesh = CreateBox('box', {})
      mesh.addBehavior(new FlipBehavior(), true)
      const flipSpy = vi.spyOn(mesh.metadata, 'flip')

      manager.apply({ meshId: mesh.id, fn: 'flip' })
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(0)
    })

    it('applies an action', async () => {
      const args = [mesh.id, 'anchor-0', false]
      manager.apply({ meshId: anchorable.id, fn: 'snap', args })
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
      manager.apply({ meshId: anchorable.id, fn: 'flip' })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).toHaveBeenCalledTimes(1)
      expect(actions).toHaveLength(1)
      expect(actions[0]).toEqual({
        meshId: anchorable.id,
        fn: 'flip',
        fromHand: false,
        duration: 500
      })
    })

    it('applies an action without recording it', () => {
      const args = [mesh.id, 'anchor-0', false]
      manager.apply({ meshId: anchorable.id, fn: 'snap', args }, true)
      expect(snapSpy).toHaveBeenCalledTimes(1)
      expect(snapSpy).toHaveBeenCalledWith(...args)
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })

    it('applies a move', async () => {
      const pos = [
        faker.datatype.number(),
        faker.datatype.number(),
        faker.datatype.number()
      ]
      manager.apply({ meshId: mesh.id, pos })
      expect(mesh.absolutePosition.asArray()).toEqual(pos)
      expect(actions).toHaveLength(0)
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      await sleep()
      expect(controlledChangeReceived).toHaveBeenCalledTimes(1)
      expect(controlledChangeReceived.mock.calls[0][0].has(mesh.id)).toBe(true)
    })

    it('handles unsupported messages', async () => {
      manager.apply({ meshId: mesh.id, position: [3, 3, 3] })
      expect(mesh.absolutePosition.asArray()).toEqual([0, 0, 0])
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
      await sleep()
      expect(controlledChangeReceived).toHaveBeenCalledTimes(1)
    })

    it('handles unsupported action', async () => {
      manager.apply({ meshId: anchorable.id, fn: 'rotate' })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
      await sleep()
      expect(controlledChangeReceived).toHaveBeenCalledTimes(1)
    })

    it('handles mesh without metadata', () => {
      manager.apply({ meshId: mesh.id, fn: 'snap' })
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
        args: [mesh.id, 'anchor-0']
      })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })
  })

  describe('record()', () => {
    it('ignores uncontrolled mesh', async () => {
      const mesh = CreateBox('box4', {})
      manager.record({ mesh, fn: 'flip' })
      expect(actions).toHaveLength(0)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(0)
    })

    it('handled unsupported messages', async () => {
      manager.record()
      manager.record({ id: 'box', fn: 'flip' })
      expect(actions).toHaveLength(0)
      expect(controlledChangeReceived).toHaveBeenCalledTimes(0)
    })

    it('distunguishes action from main and hand scenes', () => {
      manager.registerControlable(mesh)
      manager.registerControlable(handMesh)
      manager.record({ mesh, fn: 'flip' })
      manager.record({ mesh: handMesh, fn: 'rotate' })
      manager.record({ mesh: handMesh, fn: 'draw' })
      manager.record({ mesh, fn: 'draw' })
      expect(actions).toEqual([
        { meshId: mesh.id, fn: 'flip', fromHand: false },
        { meshId: handMesh.id, fn: 'rotate', fromHand: true },
        { meshId: handMesh.id, fn: 'draw', fromHand: false },
        { meshId: mesh.id, fn: 'draw', fromHand: false }
      ])
    })
  })
})
