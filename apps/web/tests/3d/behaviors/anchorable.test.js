import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import {
  configures3dTestEngine,
  expectPosition,
  expectRotated,
  expectSnapped,
  expectUnsnapped,
  expectZoneEnabled,
  sleep
} from '../../test-utils'
import {
  AnchorBehavior,
  AnchorBehaviorName,
  AnimateBehavior,
  RotateBehavior,
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

  it('can not snap without mesh', async () => {
    const snapped = CreateBox('box', {})
    snapped.setAbsolutePosition(new Vector3(1, 1, 1))
    const anchor = CreateBox('anchor', {})
    const behavior = new AnchorBehavior()
    behavior.addZone(anchor, 1)

    await behavior.snap(snapped.id, anchor.id)
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

  it('can not unsnap a stack of mesh not previously snapped', () => {
    const snapped = CreateBox('box', {})
    const stacked = makeStack(snapped)

    const behavior = new AnchorBehavior()
    behavior.addZone(CreateBox('anchor', {}), 1)

    behavior.unsnap(stacked.id)
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
      expect(behavior.getSnappedIds()).toEqual([])
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
      expect(behavior.getSnappedIds()).toEqual([])
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
      expectSnapped(mesh, meshes[0], 0)
      expect(behavior.getSnappedIds()).toEqual([meshes[0].id])
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('snaps rotable meshes when hydrating', () => {
      const snapped = meshes[0]
      snapped.addBehavior(new RotateBehavior({ angle: 0 }), true)
      expectRotated(snapped, 0)

      const angle = Math.PI * 0.5
      mesh.addBehavior(new RotateBehavior({ angle }), true)
      expectRotated(mesh, angle)
      behavior.fromState({
        anchors: [{ width: 1, height: 2, depth: 0.5, snappedId: snapped.id }]
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
      expectRotated(mesh, angle)
      expectSnapped(mesh, snapped, 0)
      expectRotated(snapped, 0, angle)
      expect(behavior.getSnappedIds()).toEqual([snapped.id])
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('snaps mesh', async () => {
      const snapped = meshes[0]
      expect(snapped.absolutePosition.asArray()).toEqual([10, 10, 10])
      expect(behavior.snappedZone(snapped.id)).toBeNull()

      const args = [snapped.id, behavior.zones[0].mesh.id]
      await mesh.metadata.snap(...args)
      expectSnapped(mesh, snapped, 0)
      expect(behavior.getSnappedIds()).toEqual([meshes[0].id])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args
      })
    })

    it('snaps a stack of mesh', async () => {
      const snapped = meshes[0]
      const stacked = makeStack(snapped)
      expectPosition(snapped, [10, 10, 10])
      expectPosition(stacked, [10, computeYAbove(stacked, snapped), 10])
      expect(behavior.snappedZone(snapped.id)).toBeNull()

      const args = [snapped.id, behavior.zones[0].mesh.id]
      await mesh.metadata.snap(...args)
      expectSnapped(mesh, snapped, 0)
      expect(behavior.getSnappedIds()).toEqual([meshes[0].id])
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

    it('snaps mesh with snapped meshes', async () => {
      const [snapped, snappedOfSnapped] = meshes
      snapped.addBehavior(
        new AnchorBehavior({
          anchors: [{ z: -1, snappedId: snappedOfSnapped.id }]
        })
      )
      expectSnapped(snapped, snappedOfSnapped, 0)

      const args = [snapped.id, behavior.zones[0].mesh.id]
      await mesh.metadata.snap(...args)
      expectSnapped(mesh, snapped, 0)
      expectSnapped(snapped, snappedOfSnapped, 0)
      expect(behavior.getSnappedIds()).toEqual([meshes[0].id])
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

      expectSnapped(mesh, snapped, 1)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args: [snapped.id, behavior.zones[1].mesh.id]
      })
    })

    it('keeps rotation when snaping rotated mesh', async () => {
      const angle = Math.PI * 0.5
      const snapped = meshes[0]
      snapped.addBehavior(new RotateBehavior({ angle }), true)
      expectRotated(snapped, angle)
      expect(snapped.absolutePosition.asArray()).toEqual([10, 10, 10])

      mesh.addBehavior(new RotateBehavior({ angle }), true)
      expectRotated(mesh, angle)

      const args = [snapped.id, behavior.zones[0].mesh.id]
      await mesh.metadata.snap(...args)
      expectSnapped(mesh, snapped, 0)
      expect(behavior.getSnappedIds()).toEqual([meshes[0].id])
      expectRotated(mesh, angle)
      expectRotated(snapped, 0, angle)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args
      })
    })

    it('does not snap on an busy anchor', async () => {
      const snapped = meshes[0]
      behavior.fromState({
        anchors: [{ width: 1, height: 2, depth: 0.5, snappedId: snapped.id }]
      })
      expectSnapped(mesh, snapped, 0)

      await mesh.metadata.snap(meshes[1].id, behavior.zones[0].mesh.id)
      expectSnapped(mesh, snapped, 0)
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('unsnaps mesh', async () => {
      const snapped = meshes[0]
      behavior.fromState({
        anchors: [{ width: 1, height: 2, depth: 0.5, snappedId: snapped.id }]
      })
      expectSnapped(mesh, snapped, 0)

      mesh.metadata.unsnap(snapped.id)
      expectUnsnapped(mesh, snapped, 0)
      expect(behavior.getSnappedIds()).toEqual([])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped.id]
      })
    })

    it('unsnaps a stack of mesh', async () => {
      const snapped = meshes[0]
      const stacked = makeStack(snapped)
      behavior.fromState({
        anchors: [{ width: 1, height: 2, depth: 0.5, snappedId: snapped.id }]
      })
      expectSnapped(mesh, snapped, 0)

      mesh.metadata.unsnap(stacked.id)
      expect(behavior.getSnappedIds()).toEqual([])
      expectUnsnapped(mesh, snapped, 0)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [stacked.id]
      })
    })

    it('unsnaps dragged mesh', async () => {
      const snapped = meshes[1]
      behavior.fromState({
        anchors: [{ width: 1, height: 2, depth: 0.5, snappedId: snapped.id }]
      })
      expectSnapped(mesh, snapped, 0)

      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        mesh: snapped
      })
      expectUnsnapped(mesh, snapped, 0)
      expect(behavior.getSnappedIds()).toEqual([])
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
      expectSnapped(mesh, snapped, 0)

      selectionManager.select(snapped)
      selectionManager.select(meshes[0])

      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        mesh: meshes[0]
      })
      expectUnsnapped(mesh, snapped, 0)
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped.id]
      })
    })

    it('keeps rotation when unsnaping rotated mesh', async () => {
      const angle = Math.PI * 0.5
      const snapped = meshes[0]
      snapped.addBehavior(new RotateBehavior({ angle }), true)
      mesh.addBehavior(new RotateBehavior({ angle }), true)
      await mesh.metadata.snap(snapped.id, behavior.zones[0].mesh.id)
      expectSnapped(mesh, snapped)
      expectRotated(mesh, angle)
      expectRotated(snapped, 0, angle)

      mesh.metadata.unsnap(snapped.id)
      expectUnsnapped(mesh, snapped, 0)
      expectRotated(mesh, angle)
      expectRotated(snapped, angle)
    })

    it('moves all when dragging current mesh', async () => {
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
      expectSnapped(mesh, meshes[0], 0)
      expectSnapped(mesh, meshes[1], 1)
      expectPosition(meshes[0], [0, computeYAbove(meshes[0], mesh), 0])
      expectPosition(meshes[1], [2, computeYAbove(meshes[1], mesh), 1])
      const x = 5
      const y = 3
      const z = 4

      inputManager.onDragObservable.notifyObservers({ type: 'dragStart', mesh })
      inputManager.onDragObservable.notifyObservers({ type: 'dragMove', mesh })
      animateMove(mesh, new Vector3(x, y, z), 0, false)

      expectPosition(mesh, [x, y, z])
      expectSnapped(mesh, meshes[0], 0)
      expectSnapped(mesh, meshes[1], 1)
      expectPosition(meshes[0], [x, computeYAbove(meshes[0], mesh), z])
      expectPosition(meshes[1], [x + 2, computeYAbove(meshes[1], mesh), z + 1])
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('moves all when dragging selection with current mesh', () => {
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
      expectSnapped(mesh, meshes[0], 0)
      expectSnapped(mesh, meshes[1], 1)

      selectionManager.select(mesh)
      selectionManager.select(meshes[0])

      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        mesh: mesh
      })

      expectSnapped(mesh, meshes[0], 0)
      expectSnapped(mesh, meshes[1], 1)
      expect(recordSpy).not.toHaveBeenCalled()
    })

    it('can disable all anchors', () => {
      expectZoneEnabled(mesh, 0)
      expectZoneEnabled(mesh, 1)

      behavior.disable()
      expectZoneEnabled(mesh, 0, false)
      expectZoneEnabled(mesh, 1, false)
    })

    it('can enable all anchors', () => {
      behavior.disable()

      behavior.enable()
      expectZoneEnabled(mesh, 0)
      expectZoneEnabled(mesh, 1)
    })

    it('does not enable anchors with snapped meshes', async () => {
      await mesh.metadata.snap(meshes[1].id, behavior.zones[1].mesh.id)
      expectSnapped(mesh, meshes[1], 1)
      behavior.disable()

      behavior.enable()
      expectZoneEnabled(mesh, 0)
      expectZoneEnabled(mesh, 1, false)
    })

    function expectAnchor(
      rank,
      { width, height, depth, x = 0, y = 0, z = 0 },
      isEnabled = true,
      kinds = undefined
    ) {
      const zone = behavior.zones[rank]
      expect(zone).toBeDefined()
      expectZoneEnabled(mesh, rank, isEnabled)
      expect(zone.kinds).toEqual(kinds)
      const { boundingBox } = zone.mesh.getBoundingInfo()
      expect(boundingBox.extendSize.x * 2).toEqual(width)
      expect(boundingBox.extendSize.y * 2).toEqual(height)
      expect(boundingBox.extendSize.z * 2).toEqual(depth)
      expect(zone.mesh.absolutePosition.asArray()).toEqual([x, y, z])
    }
  })
})

function makeStack(mesh) {
  const stacked = CreateBox('stacked-box1', {})
  stacked.addBehavior(new AnimateBehavior(), true)
  stacked.addBehavior(new StackBehavior(), true)
  mesh.addBehavior(new StackBehavior({ stackIds: [stacked.id] }), true)
  return stacked
}
