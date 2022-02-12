import { PointerEventTypes } from '@babylonjs/core/Events/pointerEvents'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import { configures3dTestEngine } from '../../test-utils'
import { controlManager as manager } from '../../../src/3d/managers'
import { AnchorBehavior, FlipBehavior } from '../../../src/3d/behaviors'

describe('ControlManager', () => {
  let scene
  let handScene
  let actions
  let mesh
  let handMesh
  let anchorable
  let snapSpy
  let flipSpy
  let playerId
  let pointer
  let currentPointer = null

  configures3dTestEngine(created => ({ scene, handScene } = created))

  beforeEach(() => {
    jest.resetAllMocks()
    actions = []
    currentPointer = null

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
    snapSpy = jest.spyOn(anchorable.metadata, 'snap')
    flipSpy = jest.spyOn(anchorable.metadata, 'flip')

    manager.registerControlable(mesh)
    manager.registerControlable(anchorable)

    playerId = faker.datatype.uuid()
    manager.movePeerPointer({ playerId, pointer: [0, 0, 0] })
    pointer = manager.getPeerPointer(playerId)
  })

  beforeAll(() => {
    manager.onActionObservable.add(action => actions.push(action))
    manager.onPointerObservable.add(({ pointer }) => {
      currentPointer = pointer
    })
  })

  describe('init()', () => {
    beforeEach(() => {
      manager.init({ scene, handScene })
      expect(currentPointer).toBeNull()
    })

    it('propagates current player pointer position', () => {
      scene.onPrePointerObservable.notifyObservers({
        type: PointerEventTypes.POINTERMOVE,
        localPosition: { x: 100, y: 200 }
      })
      expect(currentPointer).toEqual([
        -42.70810574484502, 0, 15.609075959304086
      ])
      scene.onPrePointerObservable.notifyObservers({
        type: PointerEventTypes.POINTERMOVE,
        localPosition: { x: 200, y: 250 }
      })
      expect(currentPointer).toEqual([
        -37.37054532106592, 0, 12.861383930145937
      ])
    })

    it('ignores other pointer actions', () => {
      scene.onPrePointerObservable.notifyObservers({
        type: PointerEventTypes.POINTERDOWN,
        localPosition: { x: 100, y: 200 }
      })
      expect(currentPointer).toBeNull()
    })

    it('ignores pointer moves outside of table', () => {
      scene.onPrePointerObservable.notifyObservers({
        type: PointerEventTypes.POINTERMOVE,
        localPosition: { x: 100000, y: 200000 }
      })
      expect(currentPointer).toBeNull()
    })
  })

  describe('registerControlable()', () => {
    it('registers a mesh', () => {
      const mesh = CreateBox('box3', {})
      expect(manager.isManaging(mesh)).toBe(false)

      manager.registerControlable(mesh)
      expect(manager.isManaging(mesh)).toBe(true)
    })

    it('automatically unregisters a mesh upon disposal', () => {
      const mesh = CreateBox('box3', {})
      manager.registerControlable(mesh)
      expect(manager.isManaging(mesh)).toBe(true)

      mesh.dispose()
      expect(manager.isManaging(mesh)).toBe(false)
    })
  })

  describe('unregisterControlable()', () => {
    it('ignores uncontrolled mesh', () => {
      const mesh = CreateBox('box3', {})
      expect(manager.isManaging(mesh)).toBe(false)

      manager.unregisterControlable(mesh)
      expect(manager.isManaging(mesh)).toBe(false)
    })
  })

  describe('apply()', () => {
    it('ignores uncontrolled mesh', () => {
      const mesh = CreateBox('box', {})
      mesh.addBehavior(new FlipBehavior(), true)
      const flipSpy = jest.spyOn(mesh.metadata, 'flip')

      manager.apply({ meshId: mesh.id, fn: 'flip' })
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })

    it('applies an action', () => {
      const args = [mesh.id, 'anchor-0']
      manager.apply({ meshId: anchorable.id, fn: 'snap', args })
      expect(snapSpy).toHaveBeenCalledTimes(1)
      expect(snapSpy).toHaveBeenCalledWith(...args)
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(1)
      expect(actions[0]).toEqual({
        meshId: anchorable.id,
        fn: 'snap',
        args,
        fromHand: false
      })
    })

    it('applies an action without arguments', () => {
      manager.apply({ meshId: anchorable.id, fn: 'flip' })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).toHaveBeenCalledTimes(1)
      expect(actions).toHaveLength(1)
      expect(actions[0]).toEqual({
        meshId: anchorable.id,
        fn: 'flip',
        fromHand: false
      })
    })

    it('applies an action without recording it', () => {
      const args = [mesh.id, 'anchor-0']
      manager.apply({ meshId: anchorable.id, fn: 'snap', args }, true)
      expect(snapSpy).toHaveBeenCalledTimes(1)
      expect(snapSpy).toHaveBeenCalledWith(...args)
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })

    it('applies a move', () => {
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
    })

    it('handles unsupported messages', () => {
      manager.apply({ meshId: mesh.id, position: [3, 3, 3] })
      expect(mesh.absolutePosition.asArray()).toEqual([0, 0, 0])
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
    })

    it('handles unsupported action', () => {
      manager.apply({ meshId: anchorable.id, fn: 'rotate' })
      expect(snapSpy).not.toHaveBeenCalled()
      expect(flipSpy).not.toHaveBeenCalled()
      expect(actions).toHaveLength(0)
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
    })

    it('handled unsupported messages', async () => {
      manager.record()
      manager.record({ id: 'box', fn: 'flip' })
      expect(actions).toHaveLength(0)
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

  describe('movePeerPointer()', () => {
    it('creates a peer pointer for new player', () => {
      const x = faker.datatype.number()
      const z = faker.datatype.number()
      const playerId = faker.datatype.uuid()
      expect(manager.getPeerPointer(playerId)).not.toBeDefined()

      manager.movePeerPointer({ playerId, pointer: [x, 0, z] })
      pointer = manager.getPeerPointer(playerId)
      expect(pointer).toBeDefined()
      expect(pointer.absolutePosition.asArray()).toEqual([x, 0.5, z])
    })

    it('moves an existing peer pointer', () => {
      expect(pointer.absolutePosition.asArray()).toEqual([0, 0.5, 0])

      const x = faker.datatype.number()
      const z = faker.datatype.number()
      manager.movePeerPointer({ playerId, pointer: [x, 0, z] })
      expect(pointer.absolutePosition.asArray()).toEqual([x, 0.5, z])
    })
  })

  describe('pruneUnusedPeerPointers()', () => {
    it('removes unconnected peer pointers', () => {
      expect(manager.getPeerPointer(playerId)).toBeDefined()

      manager.pruneUnusedPeerPointers([faker.datatype.uuid()])
      expect(manager.getPeerPointer(playerId)).not.toBeDefined()
      expect(pointer.isDisposed()).toBe(true)
    })

    it('keeps connected peer pointer', () => {
      const playerId2 = faker.datatype.uuid()
      manager.movePeerPointer({ playerId: playerId2, pointer: [0, 0, 0] })
      expect(manager.getPeerPointer(playerId2)).toBeDefined()
      expect(manager.getPeerPointer(playerId)).toBeDefined()

      manager.pruneUnusedPeerPointers([playerId2])
      expect(manager.getPeerPointer(playerId2)).toBeDefined()
      expect(manager.getPeerPointer(playerId)).not.toBeDefined()
      expect(pointer.isDisposed()).toBe(true)
      expect(manager.getPeerPointer(playerId2).isDisposed()).toBe(false)
    })
  })
})
