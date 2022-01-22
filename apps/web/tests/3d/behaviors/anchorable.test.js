import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import { configures3dTestEngine, expectPosition, sleep } from '../../test-utils'
import {
  AnchorBehavior,
  AnchorBehaviorName,
  AnimateBehavior,
  StackBehavior
} from '../../../src/3d/behaviors'
import {
  controlManager,
  inputManager,
  selectionManager
} from '../../../src/3d/managers'
import { animateMove, computeYAbove } from '../../../src/3d/utils'

describe('AnchorBehavior', () => {
  configures3dTestEngine()

  const recordSpy = jest.spyOn(controlManager, 'record')

  beforeEach(() => {
    jest.resetAllMocks()
    selectionManager.clear()
  })

  it('has initial state', () => {
    const state = {
      duration: faker.datatype.number()
    }
    const behavior = new AnchorBehavior(state)

    expect(behavior.name).toEqual(AnchorBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.zones).toEqual([])
    expect(behavior.mesh).toBeNull()
  })

  it('can not snap without mesh', () => {
    const snapped = CreateBox('box', {})
    snapped.setAbsolutePosition(new Vector3(1, 1, 1))
    const anchor = CreateBox('anchor', {})
    const behavior = new AnchorBehavior()
    behavior.addZone(anchor, 1)

    behavior.snap(snapped.id, anchor.id)
    expect(snapped.absolutePosition.asArray()).toEqual([1, 1, 1])
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('can not unsnap a mesh not previously snapped', () => {
    const snapped = CreateBox('box', {})

    const behavior = new AnchorBehavior()
    behavior.addZone(CreateBox('anchor', {}), 1)

    behavior.unsnap(snapped.id)
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new AnchorBehavior().fromState()).toThrow(
      'Can not restore state without mesh'
    )
  })

  describe('given attached to a mesh with zones', () => {
    let mesh
    let meshes
    let behavior

    beforeEach(() => {
      mesh = CreateBox('box', { width: 5, depth: 5 })
      mesh.addBehavior(new AnimateBehavior(), true)
      meshes = Array.from({ length: 2 }, (_, rank) => {
        const box = CreateBox(`box${rank + 1}`, {})
        box.addBehavior(new AnimateBehavior(), true)
        box.setAbsolutePosition(new Vector3(rank + 10, rank + 10, rank + 10))
        return box
      })

      behavior = new AnchorBehavior({
        anchors: [
          { x: 0.25, y: 0.75, z: 0.5, width: 1, height: 1.5, depth: 0.5 },
          { width: 1.5, height: 1, depth: 0.25 }
        ]
      })
      mesh.addBehavior(behavior, true)
    })

    it('attaches metadata to its mesh', () => {
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        { x: 0.25, y: 0.75, z: 0.5, width: 1, height: 1.5, depth: 0.5 },
        { width: 1.5, height: 1, depth: 0.25 }
      ])
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          anchors: behavior.state.anchors,
          snap: expect.any(Function),
          unsnap: expect.any(Function)
        })
      )
      expect(behavior.zones).toHaveLength(behavior.state.anchors.length)
      expectAnchor(0, behavior.state.anchors[0])
      expectAnchor(1, behavior.state.anchors[1])
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('can hydrate from state', () => {
      const duration = faker.datatype.number()

      behavior.fromState({
        duration,
        anchors: [
          { x: 1, y: 1, z: 0, width: 1, height: 2, depth: 0.5 },
          { x: -1, y: 1, z: 0, width: 2, height: 1, depth: 0.25 },
          { width: 1, height: 1, depth: 1, kinds: ['cards'] }
        ]
      })
      expect(behavior.state.duration).toEqual(duration)
      expect(behavior.state.anchors).toEqual([
        { x: 1, y: 1, z: 0, width: 1, height: 2, depth: 0.5 },
        { x: -1, y: 1, z: 0, width: 2, height: 1, depth: 0.25 },
        { width: 1, height: 1, depth: 1, kinds: ['cards'] }
      ])
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          anchors: behavior.state.anchors,
          snap: expect.any(Function),
          unsnap: expect.any(Function)
        })
      )
      expect(behavior.zones).toHaveLength(behavior.state.anchors.length)
      expectAnchor(0, behavior.state.anchors[0])
      expectAnchor(1, behavior.state.anchors[1])
      expectAnchor(2, behavior.state.anchors[2], true, ['cards'])
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('disposes previous anchors when hydrating', () => {
      expect(behavior.zones).toHaveLength(2)
      expect(behavior.state.anchors).toHaveLength(2)
      const previousAnchors = behavior.zones.map(({ mesh }) => mesh)

      behavior.fromState({
        anchors: [{ width: 1, height: 2, depth: 0.5 }]
      })
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        { width: 1, height: 2, depth: 0.5 }
      ])
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          anchors: behavior.state.anchors,
          snap: expect.any(Function),
          unsnap: expect.any(Function)
        })
      )
      expect(behavior.zones).toHaveLength(behavior.state.anchors.length)
      expectAnchor(0, behavior.state.anchors[0])
      expect(previousAnchors.every(mesh => mesh.isDisposed())).toBe(true)
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('discards unknown snapped meshes when hydrating', () => {
      behavior.fromState({
        anchors: [{ width: 1, height: 2, depth: 0.5, snappedId: 'unknown' }]
      })
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        { width: 1, height: 2, depth: 0.5 }
      ])
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          anchors: behavior.state.anchors,
          snap: expect.any(Function),
          unsnap: expect.any(Function)
        })
      )
      expect(behavior.zones).toHaveLength(behavior.state.anchors.length)
      expectAnchor(0, behavior.state.anchors[0])
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('snaps meshes when hydrating', () => {
      behavior.fromState({
        anchors: [{ width: 1, height: 2, depth: 0.5, snappedId: meshes[0].id }]
      })
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        { width: 1, height: 2, depth: 0.5, snappedId: 'box1' }
      ])
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          anchors: behavior.state.anchors,
          snap: expect.any(Function),
          unsnap: expect.any(Function)
        })
      )
      expect(behavior.zones).toHaveLength(behavior.state.anchors.length)
      expectAnchor(0, behavior.state.anchors[0], false)
      expectSnapped(meshes[0], 0)
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('snaps mesh', async () => {
      const snapped = meshes[0]
      expect(snapped.absolutePosition.asArray()).toEqual([10, 10, 10])
      expect(behavior.snappedZone(snapped.id)).toBeNull()

      const args = [snapped.id, behavior.zones[0].mesh.id]
      await mesh.metadata.snap(...args)
      expectSnapped(snapped, 0)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args
      })
    })

    it('snaps a stack of mesh', async () => {
      const stacked = CreateBox('stacked-box1', {})
      stacked.addBehavior(new AnimateBehavior(), true)
      const snapped = meshes[0]

      snapped.addBehavior(new StackBehavior({ stackIds: [stacked.id] }), true)
      expectPosition(snapped, [10, 10, 10])
      expectPosition(stacked, [10, computeYAbove(stacked, snapped), 10])
      expect(behavior.snappedZone(snapped.id)).toBeNull()

      const args = [snapped.id, behavior.zones[0].mesh.id]
      await mesh.metadata.snap(...args)
      expectSnapped(snapped, 0)
      expectPosition(stacked, [
        snapped.absolutePosition.x,
        computeYAbove(stacked, snapped),
        snapped.absolutePosition.z
      ])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args
      })
    })

    it('snaps dropped mesh', async () => {
      const snapped = meshes[1]
      expect(snapped.absolutePosition.asArray()).toEqual([11, 11, 11])
      expect(behavior.snappedZone(snapped.id)).toBeNull()
      behavior.onDropObservable.notifyObservers({
        dropped: [snapped],
        zone: behavior.zones[1]
      })
      await sleep(behavior.state.duration * 2)

      expectSnapped(snapped, 1)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args: [snapped.id, behavior.zones[1].mesh.id]
      })
    })

    it('unsnaps mesh', async () => {
      const snapped = meshes[0]
      behavior.fromState({
        anchors: [{ width: 1, height: 2, depth: 0.5, snappedId: snapped.id }]
      })
      expectSnapped(snapped, 0)

      mesh.metadata.unsnap(snapped.id)
      expectUnsnapped(snapped, 0)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped.id]
      })
    })

    it('unsnaps dragged mesh', async () => {
      const snapped = meshes[1]
      behavior.fromState({
        anchors: [{ width: 1, height: 2, depth: 0.5, snappedId: snapped.id }]
      })
      expectSnapped(snapped, 0)

      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        mesh: snapped
      })
      expectUnsnapped(snapped, 0)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped.id]
      })
    })

    it('unsnaps dragged selection', async () => {
      const snapped = meshes[1]
      behavior.fromState({
        anchors: [{ width: 1, height: 2, depth: 0.5, snappedId: snapped.id }]
      })
      expectSnapped(snapped, 0)

      selectionManager.select(snapped)
      selectionManager.select(meshes[0])

      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        mesh: meshes[0]
      })
      expectUnsnapped(snapped, 0)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped.id]
      })
    })

    it('unsnaps all when dragging current mesh', async () => {
      behavior.fromState({
        anchors: [
          { width: 1, height: 2, depth: 0.5, snappedId: meshes[0].id },
          {
            width: 1,
            height: 2,
            depth: 0.5,
            snappedId: meshes[1].id,
            x: 2,
            y: 3,
            z: 1
          }
        ]
      })
      expectSnapped(meshes[0], 0)
      expectSnapped(meshes[1], 1)
      const position = [5, 3, 4]

      inputManager.onDragObservable.notifyObservers({ type: 'dragStart', mesh })
      inputManager.onDragObservable.notifyObservers({ type: 'dragMove', mesh })
      animateMove(mesh, new Vector3(...position), 0, false)

      expectPosition(mesh, position)
      expectUnsnapped(meshes[0], 0)
      expectUnsnapped(meshes[1], 1)
      expect(recordSpy).toHaveBeenCalledTimes(2)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        fn: 'unsnap',
        meshId: mesh.id,
        args: [meshes[0].id]
      })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        fn: 'unsnap',
        meshId: mesh.id,
        args: [meshes[1].id]
      })
    })

    it('does not unsnap parts of the active selection', () => {
      behavior.fromState({
        anchors: [
          { width: 1, height: 2, depth: 0.5, snappedId: meshes[0].id },
          {
            width: 1,
            height: 2,
            depth: 0.5,
            snappedId: meshes[1].id,
            x: 2,
            y: 3,
            z: 1
          }
        ]
      })
      expectSnapped(meshes[0], 0)
      expectSnapped(meshes[1], 1)

      selectionManager.select(mesh)
      selectionManager.select(meshes[0])

      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        mesh: mesh
      })

      expectSnapped(meshes[0], 0)
      expectUnsnapped(meshes[1], 1)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [meshes[1].id]
      })
    })

    it('can disable all anchors', () => {
      expectZoneEnabled(0)
      expectZoneEnabled(1)

      behavior.disable()
      expectZoneEnabled(0, false)
      expectZoneEnabled(1, false)
    })

    it('can enable all anchors', () => {
      behavior.disable()

      behavior.enable()
      expectZoneEnabled(0)
      expectZoneEnabled(1)
    })

    it('does enable anchors with snapped meshes', () => {
      mesh.metadata.snap(meshes[1].id, behavior.zones[1].mesh.id)
      behavior.disable()

      behavior.enable()
      expectZoneEnabled(0)
      expectZoneEnabled(1, false)
    })

    function expectAnchor(
      rank,
      { width, height, depth, x = 0, y = 0, z = 0 },
      isEnabled = true,
      kinds = undefined
    ) {
      const zone = behavior.zones[rank]
      expect(zone).toBeDefined()
      expectZoneEnabled(rank, isEnabled)
      expect(zone.kinds).toEqual(kinds)
      const { boundingBox } = zone.mesh.getBoundingInfo()
      expect(boundingBox.extendSize.x * 2).toEqual(width)
      expect(boundingBox.extendSize.y * 2).toEqual(height)
      expect(boundingBox.extendSize.z * 2).toEqual(depth)
      expect(zone.mesh.absolutePosition.asArray()).toEqual([x, y, z])
    }

    function expectSnapped(snapped, anchorRank) {
      const anchor = behavior.state.anchors[anchorRank]
      const zone = behavior.zones[anchorRank]
      expectZoneEnabled(anchorRank, false)
      expect(behavior.snappedZone(snapped.id)).toEqual(zone)
      expect(anchor.snappedId).toEqual(snapped.id)
      expect(mesh.metadata.anchors[anchorRank].snappedId).toEqual(snapped.id)
      expectPosition(snapped, [
        zone.mesh.absolutePosition.x,
        computeYAbove(snapped, mesh),
        zone.mesh.absolutePosition.z
      ])
      // expect(snapped.parent?.id).toEqual(mesh.id)
    }

    function expectUnsnapped(snapped, anchorRank) {
      const anchor = behavior.state.anchors[anchorRank]
      expectZoneEnabled(anchorRank)
      expect(behavior.snappedZone(snapped.id)).toBeNull()
      expect(anchor.snappedId).not.toBeDefined()
      expect(mesh.metadata.anchors[anchorRank].snappedId).not.toBeDefined()
      // expect(snapped.parent?.id).toBeUndefined()
    }

    function expectZoneEnabled(rank, enabled = true) {
      expect(behavior.zones[rank]?.enabled).toBe(enabled)
    }
  })
})
