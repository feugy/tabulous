// @ts-check
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import {
  AnchorBehavior,
  AnchorBehaviorName,
  AnimateBehavior,
  DrawBehavior,
  FlipBehavior,
  RotateBehavior
} from '@src/3d/behaviors'
import { StackBehavior } from '@src/3d/behaviors/stackable'
import { createRoundToken } from '@src/3d/meshes'
import { animateMove, getCenterAltitudeAbove } from '@src/3d/utils'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

import {
  configures3dTestEngine,
  createBox,
  expectFlipped,
  expectMeshFeedback,
  expectMoveRecorded,
  expectPosition,
  expectRotated,
  expectSnapped,
  expectStacked,
  expectUnsnapped,
  expectZoneEnabled,
  sleep
} from '../../test-utils'

describe('AnchorBehavior', () => {
  configures3dTestEngine(
    created => {
      scene = created.scene
      managers = created.managers
    },
    { isSimulation: globalThis.use3dSimulation }
  )

  const actionRecorded = vi.fn()
  const moveRecorded = vi.fn()
  /** @type {import('@babylonjs/core').Scene} */
  let scene
  /** @type {import('@src/3d/managers').Managers} */
  let managers
  /** @type {import('vitest').Spy<import('@src/3d/managers').IndicatorManager['registerFeedback']>} */
  let registerFeedbackSpy
  /** @type {?import('@babylonjs/core').Observer<?>} */
  let moveObserver

  beforeAll(() => {
    moveObserver = managers.move.onMoveObservable.add(moveRecorded)
    managers.control.onActionObservable.add(data => actionRecorded(data))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    registerFeedbackSpy = vi.spyOn(managers.indicator, 'registerFeedback')
    vi.spyOn(managers.hand, 'draw').mockImplementation(async mesh => {
      managers.control.record({ mesh, fn: 'draw', args: [] })
    })
    managers.selection.clear()
  })

  afterAll(() => {
    managers.move.onMoveObservable.remove(moveObserver)
  })

  it('has initial state', () => {
    const state = {
      duration: faker.number.int(999)
    }
    const behavior = new AnchorBehavior(state, managers)

    expect(behavior.name).toEqual(AnchorBehaviorName)
    expect(behavior.state).toEqual(state)
    expect(behavior.zones).toEqual([])
    expect(behavior.mesh).toBeNull()
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not snap without mesh', async () => {
    const snapped = createBox('box', {})
    snapped.setAbsolutePosition(new Vector3(1, 1, 1))
    const anchor = createBox('anchor', {})
    const behavior = new AnchorBehavior({}, managers)
    behavior.addZone(anchor, { extent: 1 })

    await behavior.snap?.(snapped.id, anchor.id)
    expect(snapped.absolutePosition.asArray()).toEqual([1, 1, 1])
    expect(actionRecorded).not.toHaveBeenCalled()
    expectMoveRecorded(moveRecorded)
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not unsnap a mesh not previously snapped', () => {
    const snapped = createBox('box', {})

    const behavior = new AnchorBehavior({}, managers)
    behavior.addZone(createBox('anchor', {}), { extent: 1 })

    behavior.unsnap?.(snapped.id)
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not unsnap a stack of mesh not previously snapped', () => {
    const snapped = createBox('box', {})
    const stacked = makeStack(managers, snapped)

    const behavior = new AnchorBehavior({}, managers)
    behavior.addZone(createBox('anchor', {}), { extent: 1 })

    behavior.unsnap?.(stacked.id)
    expect(actionRecorded).not.toHaveBeenCalled()
    expect(registerFeedbackSpy).not.toHaveBeenCalled()
  })

  it('can not restore state without mesh', () => {
    expect(() => new AnchorBehavior({}, managers).fromState()).toThrow(
      'Can not restore state without mesh'
    )
  })

  describe('given attached to a mesh with zones', () => {
    /** @type {import('@babylonjs/core').Mesh} */
    let mesh
    /** @type {import('@babylonjs/core').Mesh[]} */
    let meshes
    /** @type {AnchorBehavior} */
    let behavior

    beforeEach(() => {
      mesh = createBox('box', { width: 5, depth: 5 })
      mesh.addBehavior(new AnimateBehavior(), true)
      meshes = Array.from({ length: 3 }, (_, rank) => {
        const box = createBox(`box${rank + 1}`, {})
        box.addBehavior(new AnimateBehavior(), true)
        box.addBehavior(new DrawBehavior({}, managers), true)
        box.setAbsolutePosition(new Vector3(rank + 10, rank + 10, rank + 10))
        managers.control.registerControlable(box)
        return box
      })

      behavior = new AnchorBehavior(
        {
          anchors: [
            {
              id: '1',
              x: 0.25,
              y: 0.75,
              z: 0.5,
              width: 1,
              height: 1.5,
              depth: 0.5,
              snappedIds: []
            },
            { id: '2', width: 1.5, height: 1, depth: 0.25, snappedIds: [] }
          ]
        },
        managers
      )
      mesh.addBehavior(behavior, true)
      managers.control.registerControlable(mesh)
    })

    it('attaches metadata to its mesh', () => {
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        {
          id: '1',
          x: 0.25,
          y: 0.75,
          z: 0.5,
          width: 1,
          height: 1.5,
          depth: 0.5,
          snappedIds: []
        },
        { id: '2', width: 1.5, height: 1, depth: 0.25, snappedIds: [] }
      ])
      expect(mesh.metadata).toEqual(
        expect.objectContaining({
          anchors: behavior.state.anchors,
          snap: expect.any(Function),
          unsnap: expect.any(Function),
          unsnapAll: expect.any(Function)
        })
      )
      expect(behavior.zones).toHaveLength(behavior.state.anchors.length)
      expectAnchor(0, behavior.state.anchors[0])
      expectAnchor(1, behavior.state.anchors[1])
      expect(behavior.getSnappedIds()).toEqual([])
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can hydrate from state', () => {
      const duration = faker.number.int(999)

      behavior.fromState({
        duration,
        anchors: [
          {
            id: '4',
            x: 1,
            y: 1,
            z: 0,
            width: 1,
            height: 2,
            depth: 0.5,
            snappedIds: []
          },
          {
            id: '5',
            x: -1,
            y: 1,
            z: 0,
            width: 2,
            height: 1,
            depth: 0.25,
            snappedIds: []
          },
          {
            id: '6',
            width: 1,
            height: 1,
            depth: 1,
            kinds: ['cards'],
            priority: 1,
            snappedIds: []
          }
        ]
      })
      expect(behavior.state.duration).toEqual(duration)
      expect(behavior.state.anchors).toEqual([
        {
          id: '4',
          x: 1,
          y: 1,
          z: 0,
          width: 1,
          height: 2,
          depth: 0.5,
          snappedIds: []
        },
        {
          id: '5',
          x: -1,
          y: 1,
          z: 0,
          width: 2,
          height: 1,
          depth: 0.25,
          snappedIds: []
        },
        {
          id: '6',
          width: 1,
          height: 1,
          depth: 1,
          kinds: ['cards'],
          priority: 1,
          snappedIds: []
        }
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
      expectAnchor(2, behavior.state.anchors[2], true, ['cards'], 1)
      expect(actionRecorded).not.toHaveBeenCalled()
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can hydrate cylindric anchors', () => {
      behavior.fromState({
        anchors: [
          {
            id: '1',
            x: 1,
            y: 1,
            z: 0,
            diameter: 4,
            height: 0.5,
            extent: 1.2,
            snappedIds: []
          },
          {
            id: '2',
            x: 1,
            y: 1,
            z: 0,
            diameter: 2,
            height: 0.1,
            extent: undefined,
            snappedIds: []
          }
        ]
      })
      expect(behavior.state.anchors).toEqual([
        {
          id: '1',
          x: 1,
          y: 1,
          z: 0,
          diameter: 4,
          height: 0.5,
          extent: 1.2,
          snappedIds: []
        },
        {
          id: '2',
          x: 1,
          y: 1,
          z: 0,
          diameter: 2,
          height: 0.1,
          extent: undefined,
          snappedIds: []
        }
      ])
      expectAnchor(0, behavior.state.anchors[0])
      expectAnchor(1, behavior.state.anchors[1])
      expect(actionRecorded).not.toHaveBeenCalled()
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can hydrate square anchors on cylindric mesh', () => {
      mesh.removeBehavior(behavior)
      mesh = createRoundToken(
        {
          id: 'cylinder',
          texture: '',
          diameter: 5,
          height: 5,
          x: 4,
          y: 5,
          z: -4
        },
        managers,
        scene
      )
      mesh.addBehavior(behavior, true)
      behavior.fromState({
        anchors: [
          {
            id: '1',
            x: 0,
            y: -2,
            z: 0,
            width: 1,
            height: 2,
            depth: 3,
            snappedIds: []
          }
        ]
      })
      expect(behavior.state.anchors).toEqual([
        {
          id: '1',
          x: 0,
          y: -2,
          z: 0,
          width: 1,
          height: 2,
          depth: 3,
          snappedIds: []
        }
      ])
      expectAnchor(0, { ...behavior.state.anchors[0], x: 4, y: 3, z: -4 })
      expect(actionRecorded).not.toHaveBeenCalled()
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('disposes previous anchors when hydrating', () => {
      expect(behavior.zones).toHaveLength(2)
      expect(behavior.state.anchors).toHaveLength(2)
      const previousAnchors = behavior.zones.map(({ mesh }) => mesh)

      behavior.fromState({
        anchors: [{ id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [] }]
      })
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [] }
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
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('discards unknown snapped meshes when hydrating', () => {
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: ['unknown'] }
        ]
      })
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [] }
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
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('snaps meshes when hydrating', () => {
      behavior.fromState({
        anchors: [
          {
            id: '1',
            width: 1,
            height: 2,
            depth: 0.5,
            snappedIds: [meshes[0].id]
          },
          {
            id: '2',
            x: -2,
            width: 1,
            height: 2,
            depth: 0.5,
            max: 2,
            snappedIds: [meshes[1].id, meshes[2].id]
          }
        ]
      })
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: ['box1'] },
        {
          id: '2',
          x: -2,
          width: 1,
          height: 2,
          depth: 0.5,
          snappedIds: ['box2', 'box3'],
          max: 2
        }
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
      expectSnapped(mesh, meshes.slice(0, 1), 0)
      expectSnapped(mesh, meshes.slice(1, 3), 1)
      expect(behavior.getSnappedIds()).toEqual([
        meshes[0].id,
        meshes[1].id,
        meshes[2].id
      ])
      expect(actionRecorded).not.toHaveBeenCalled()
      expectMoveRecorded(moveRecorded)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('snaps flippable meshes when hydrating', () => {
      const snapped = meshes[0]
      snapped.addBehavior(new FlipBehavior({ isFlipped: true }, managers), true)
      expectFlipped(snapped)

      mesh.addBehavior(new FlipBehavior({ isFlipped: true }, managers), true)
      expectFlipped(mesh)
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [snapped.id] }
        ]
      })
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: ['box1'] }
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
      expectFlipped(mesh)
      expectSnapped(mesh, [snapped], 0)
      expectFlipped(snapped)
      expect(behavior.getSnappedIds()).toEqual([snapped.id])
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('snaps rotable meshes when hydrating', () => {
      const snapped = meshes[0]
      const angle = Math.PI * 0.5
      snapped.addBehavior(new RotateBehavior({ angle }, managers), true)
      expectRotated(snapped, angle)

      mesh.addBehavior(new RotateBehavior({ angle }, managers), true)
      expectRotated(mesh, angle)
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [snapped.id] }
        ]
      })
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: ['box1'] }
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
      expectSnapped(mesh, [snapped], 0)
      expectRotated(snapped, angle)
      expect(behavior.getSnappedIds()).toEqual([snapped.id])
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can rotate snapped mesh when hydrating', () => {
      const snapped = meshes[0]
      snapped.addBehavior(
        new RotateBehavior({ angle: Math.PI * 0.5 }, managers),
        true
      )
      expectRotated(snapped, Math.PI * 0.5)

      const angle = Math.PI * -0.5
      behavior.fromState({
        anchors: [
          {
            id: '1',
            width: 1,
            height: 2,
            depth: 0.5,
            snappedIds: [snapped.id],
            angle
          }
        ]
      })
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        {
          id: '1',
          width: 1,
          height: 2,
          depth: 0.5,
          snappedIds: ['box1'],
          angle
        }
      ])
      expectAnchor(0, behavior.state.anchors[0], false)
      expectSnapped(mesh, [snapped], 0)
      expectRotated(snapped, angle)
      expect(behavior.getSnappedIds()).toEqual([snapped.id])
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can flip snapped mesh when hydrating', () => {
      const snapped = meshes[0]
      snapped.addBehavior(
        new FlipBehavior({ isFlipped: false }, managers),
        true
      )
      expectFlipped(snapped, false)

      behavior.fromState({
        anchors: [
          {
            id: '1',
            width: 1,
            height: 2,
            depth: 0.5,
            snappedIds: [snapped.id],
            flip: true
          }
        ]
      })
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        {
          id: '1',
          width: 1,
          height: 2,
          depth: 0.5,
          snappedIds: ['box1'],
          flip: true
        }
      ])
      expectAnchor(0, behavior.state.anchors[0], false)
      expectSnapped(mesh, [snapped], 0)
      expectFlipped(snapped)
      expect(behavior.getSnappedIds()).toEqual([snapped.id])
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('can reset snapped mesh rotation when hydrating', () => {
      const snapped = meshes[0]
      snapped.addBehavior(
        new RotateBehavior({ angle: Math.PI * 0.5 }, managers),
        true
      )
      expectRotated(snapped, Math.PI * 0.5)

      const angle = 0
      behavior.fromState({
        anchors: [
          {
            id: '1',
            width: 1,
            height: 2,
            depth: 0.5,
            snappedIds: [snapped.id],
            angle
          }
        ]
      })
      expect(behavior.state.duration).toEqual(100)
      expect(behavior.state.anchors).toEqual([
        {
          id: '1',
          width: 1,
          height: 2,
          depth: 0.5,
          snappedIds: ['box1'],
          angle
        }
      ])
      expectAnchor(0, behavior.state.anchors[0], false)
      expectSnapped(mesh, [snapped], 0)
      expectRotated(snapped, angle)
      expect(behavior.getSnappedIds()).toEqual([snapped.id])
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('snaps mesh', async () => {
      const snapped = meshes[0]
      expect(snapped.absolutePosition.asArray()).toEqual([10, 10, 10])
      expect(behavior.snappedZone(snapped.id)).toBeNull()

      /** @type {[string, string, boolean]} */
      const args = [snapped.id, behavior.zones[0].mesh.id, false]
      await mesh.metadata.snap?.(...args)
      expectSnapped(mesh, [snapped], 0)
      expect(behavior.getSnappedIds()).toEqual([meshes[0].id])
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args,
        duration: behavior.state.duration,
        revert: [snapped.id, [10, 10, 10], undefined, undefined],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded, snapped)
      expectMeshFeedback(registerFeedbackSpy, 'snap', behavior.zones[0].mesh)
    })

    it('snaps multiple meshes', async () => {
      behavior.state.anchors[0].max = 2
      const [snapped1, snapped2] = meshes
      expect(snapped1.absolutePosition.asArray()).toEqual([10, 10, 10])
      expect(behavior.snappedZone(snapped1.id)).toBeNull()
      expect(snapped2.absolutePosition.asArray()).toEqual([11, 11, 11])
      expect(behavior.snappedZone(snapped2.id)).toBeNull()

      /** @type {[string, string, boolean]} */
      let args = [snapped1.id, behavior.zones[0].mesh.id, false]
      await mesh.metadata.snap?.(...args)
      expectZoneEnabled(mesh, 0)
      expect(behavior?.snappedZone(snapped1.id)?.mesh.id).toEqual(
        behavior?.zones[0]?.mesh.id
      )
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args,
        duration: behavior.state.duration,
        revert: [snapped1.id, [10, 10, 10], undefined, undefined],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded, snapped1)
      expectMeshFeedback(registerFeedbackSpy, 'snap', behavior.zones[0].mesh)
      expectPosition(snapped1, [10, 0.5, 10])
      registerFeedbackSpy.mockClear()
      moveRecorded.mockClear()

      args = [snapped2.id, behavior.zones[0].mesh.id, false]
      await mesh.metadata.snap?.(...args)
      expectSnapped(mesh, [snapped1, snapped2], 0)

      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args,
        duration: behavior.state.duration,
        revert: [snapped2.id, [11, 11, 11], undefined, undefined],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded, snapped2)
      expectMeshFeedback(registerFeedbackSpy, 'snap', behavior.zones[0].mesh)
      expectPosition(snapped2, [11, 1.5, 11])
    })

    it('snaps a stack of mesh', async () => {
      const snapped = meshes[0]
      const stacked = makeStack(managers, snapped)
      expectPosition(snapped, [10, 10, 10])
      expectPosition(stacked, [
        10,
        getCenterAltitudeAbove(snapped, stacked),
        10
      ])
      expect(behavior.snappedZone(snapped.id)).toBeNull()

      /** @type {[string, string, boolean]} */
      const args = [snapped.id, behavior.zones[0].mesh.id, false]
      await mesh.metadata.snap?.(...args)
      expectSnapped(mesh, [snapped], 0)
      expect(behavior.getSnappedIds()).toEqual([meshes[0].id])
      expectPosition(stacked, [
        snapped.absolutePosition.x,
        getCenterAltitudeAbove(snapped, stacked),
        snapped.absolutePosition.z
      ])
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args,
        duration: behavior.state.duration,
        revert: [snapped.id, [10, 10, 10], undefined, undefined],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded, snapped)
      expectMeshFeedback(registerFeedbackSpy, 'snap', behavior.zones[0].mesh)
    })

    it('snaps mesh with snapped meshes', async () => {
      const [snapped, snappedOfSnapped] = meshes
      snapped.addBehavior(
        new AnchorBehavior(
          {
            anchors: [{ id: '10', z: -1, snappedIds: [snappedOfSnapped.id] }]
          },
          managers
        )
      )
      expectSnapped(snapped, [snappedOfSnapped], 0)

      await mesh.metadata.snap?.(snapped.id, behavior.zones[0].mesh.id)
      expectSnapped(mesh, [snapped], 0)
      expectSnapped(snapped, [snappedOfSnapped], 0)
      expect(behavior.getSnappedIds()).toEqual([meshes[0].id])
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args: [snapped.id, behavior.zones[0].mesh.id, false],
        duration: behavior.state.duration,
        revert: [snapped.id, [10, 10, 10], undefined, undefined],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded, snapped)
      expectMeshFeedback(registerFeedbackSpy, 'snap', behavior.zones[0].mesh)
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

      expectSnapped(mesh, [snapped], 1)
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args: [snapped.id, behavior.zones[1].mesh.id, false],
        duration: behavior.state.duration,
        revert: [snapped.id, [11, 11, 11], undefined, undefined],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded, snapped)
      expectMeshFeedback(registerFeedbackSpy, 'snap', behavior.zones[1].mesh)
    })

    it('keeps rotation when snaping rotated mesh', async () => {
      const angle = Math.PI * 0.5
      const snapped = meshes[0]
      snapped.addBehavior(new RotateBehavior({ angle }, managers), true)
      expectRotated(snapped, angle)
      expect(snapped.absolutePosition.asArray()).toEqual([10, 10, 10])

      mesh.addBehavior(new RotateBehavior({ angle }, managers), true)
      expectRotated(mesh, angle)

      /** @type {[string, string, boolean]} */
      const args = [snapped.id, behavior.zones[0].mesh.id, false]
      await mesh.metadata.snap?.(...args)
      expectSnapped(mesh, [snapped], 0)
      expect(behavior.getSnappedIds()).toEqual([meshes[0].id])
      expectRotated(mesh, angle)
      expectRotated(snapped, angle)
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args,
        duration: behavior.state.duration,
        revert: [
          snapped.id,
          [10, 10, 10],
          expect.numberCloseTo(angle),
          undefined
        ],
        fromHand: false,
        isLocal: false
      })
      expectMeshFeedback(registerFeedbackSpy, 'snap', [0.25, 0.75, 0.5])
    })

    it('can set rotation when snapping rotated mesh', async () => {
      const angle = Math.PI * 0.5
      mesh.addBehavior(new RotateBehavior({ angle }, managers), true)
      expectRotated(mesh, angle)
      const snapped = meshes[0]
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, angle, snappedIds: [] }
        ]
      })
      snapped.addBehavior(
        new RotateBehavior({ angle: Math.PI * -0.5 }, managers),
        true
      )
      snapped.addBehavior(new FlipBehavior({ isFlipped: true }, managers), true)
      expectRotated(snapped, Math.PI * -0.5)
      expect(snapped.absolutePosition.asArray()).toEqual([10, 10, 10])

      /** @type {[string, string, boolean]} */
      const args = [snapped.id, behavior.zones[0].mesh.id, false]
      await mesh.metadata.snap?.(...args)
      expectSnapped(mesh, [snapped], 0)
      expect(behavior.getSnappedIds()).toEqual([meshes[0].id])
      expectRotated(snapped, -angle)
      expectFlipped(snapped)
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args,
        duration: behavior.state.duration,
        revert: [
          snapped.id,
          [10, 10, 10],
          expect.numberCloseTo(Math.PI * -0.5),
          true
        ],
        fromHand: false,
        isLocal: false
      })
      expectMeshFeedback(registerFeedbackSpy, 'snap', [0, 0, 0])
    })

    it('can flip snapped mesh', async () => {
      const snapped = meshes[0]
      behavior.fromState({
        anchors: [
          {
            id: '1',
            width: 1,
            height: 2,
            depth: 0.5,
            flip: true,
            snappedIds: []
          }
        ]
      })
      const flippable = new FlipBehavior({}, managers)
      snapped.addBehavior(flippable, true)
      expectFlipped(snapped, false)
      expect(snapped.absolutePosition.asArray()).toEqual([10, 10, 10])

      /** @type {[string, string, boolean]} */
      const args = [snapped.id, behavior.zones[0].mesh.id, false]
      await mesh.metadata.snap?.(...args)
      expectSnapped(mesh, [snapped], 0)
      expect(behavior.getSnappedIds()).toEqual([meshes[0].id])
      expectFlipped(snapped)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'snap',
        meshId: mesh.id,
        args,
        duration: behavior.state.duration,
        revert: [snapped.id, [10, 10, 10], undefined, false],
        fromHand: false,
        isLocal: false
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'flip',
        meshId: snapped.id,
        args: [],
        duration: flippable.state.duration,
        fromHand: false,
        isLocal: true
      })
      expectMeshFeedback(registerFeedbackSpy, 'snap', [0, 0, 0])
    })

    it('can revert flipped, rotated snapped mesh', async () => {
      const angle = Math.PI * 0.5
      const position = [10, 10, 10]
      mesh.addBehavior(new RotateBehavior({ angle }, managers), true)
      expectRotated(mesh, angle)
      const snapped = meshes[0]
      behavior.fromState({
        anchors: [
          {
            id: '1',
            width: 1,
            height: 2,
            depth: 0.5,
            angle,
            flip: false,
            snappedIds: []
          }
        ]
      })
      const snappedAngle = Math.PI * -0.5
      const flippable = new FlipBehavior({ isFlipped: true }, managers)
      snapped.addBehavior(
        new RotateBehavior({ angle: snappedAngle }, managers),
        true
      )
      snapped.addBehavior(flippable, true)
      expectFlipped(snapped)
      expectRotated(snapped, snappedAngle)
      expect(snapped.absolutePosition.asArray()).toEqual(position)
      await mesh.metadata.snap?.(snapped.id, behavior.zones[0].mesh.id, false)
      expectSnapped(mesh, [snapped], 0)
      expectFlipped(snapped, false)
      expectRotated(snapped, -angle)
      const { revert } =
        /** @type {Required<import('@src/3d/managers').RecordedAction>} */ (
          actionRecorded.mock.calls[0][0]
        )
      actionRecorded.mockClear()
      registerFeedbackSpy.mockClear()

      await behavior.revert('snap', revert)
      expectUnsnapped(mesh, snapped, 0)
      expect(behavior.getSnappedIds()).toEqual([])
      expectFlipped(snapped)
      expectRotated(snapped, snappedAngle)
      expect(snapped.absolutePosition.asArray()).toEqual(position)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'flip',
        meshId: snapped.id,
        args: [],
        duration: flippable.state.duration,
        fromHand: false,
        isLocal: true
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped.id, behavior.zones[0].mesh.id],
        fromHand: false,
        isLocal: true
      })
      expectMeshFeedback(registerFeedbackSpy, 'unsnap', [0, 0, 0])
    })

    it('updates snapped when reordering a stack', async () => {
      const snapped = meshes[0]
      const stacked = makeStack(managers, snapped)
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [snapped.id] }
        ]
      })
      expectSnapped(mesh, [snapped], 0)
      expectStacked(managers, [snapped, stacked], true, mesh.id)

      await stacked.metadata.reorder?.([stacked.id, snapped.id])
      expectStacked(managers, [stacked, snapped], true, mesh.id)
      expectSnapped(mesh, [stacked], 0)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('updates snapped when flipping an entire stack', async () => {
      const snapped = meshes[0]
      const stacked = makeStack(managers, snapped)
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [snapped.id] }
        ]
      })
      expectSnapped(mesh, [snapped], 0)
      expectStacked(managers, [snapped, stacked], true, mesh.id)

      await stacked.metadata.flipAll?.()
      expectStacked(managers, [stacked, snapped], true, mesh.id)
      expectSnapped(mesh, [stacked], 0)
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('does not snap on an busy anchor', async () => {
      const snapped = meshes[0]
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [snapped.id] }
        ]
      })
      expectSnapped(mesh, [snapped], 0)

      await mesh.metadata.snap?.(meshes[1].id, behavior.zones[0].mesh.id)
      expectSnapped(mesh, [snapped], 0)
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('unsnaps mesh', async () => {
      const snapped = meshes[0]
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [snapped.id] }
        ]
      })
      expectSnapped(mesh, [snapped], 0)

      mesh.metadata.unsnap?.(snapped.id)
      expectUnsnapped(mesh, snapped, 0)
      expect(behavior.getSnappedIds()).toEqual([])
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped.id, '1'],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded)
      expectMeshFeedback(registerFeedbackSpy, 'unsnap', behavior.zones[0].mesh)
    })

    it('unsnaps a stack of mesh', async () => {
      const snapped = meshes[0]
      const stacked = makeStack(managers, snapped)
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [snapped.id] }
        ]
      })
      expectSnapped(mesh, [snapped], 0)

      mesh.metadata.unsnap?.(stacked.id)
      expect(behavior.getSnappedIds()).toEqual([])
      expectUnsnapped(mesh, snapped, 0)
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [stacked.id, '1'],
        fromHand: false,
        isLocal: false
      })
      expectMeshFeedback(registerFeedbackSpy, 'unsnap', behavior.zones[0].mesh)
    })

    it('unsnaps dragged mesh', async () => {
      const snapped = meshes[1]
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [snapped.id] }
        ]
      })
      expectSnapped(mesh, [snapped], 0)

      managers.move.notifyMove(snapped)
      expectUnsnapped(mesh, snapped, 0)
      expect(behavior.getSnappedIds()).toEqual([])
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped.id, '1'],
        fromHand: false,
        isLocal: false
      })
      expectMeshFeedback(registerFeedbackSpy, 'unsnap', behavior.zones[0].mesh)
    })

    it('does not flip mesh when unsnapping them', async () => {
      const snapped = meshes[0]
      behavior.fromState({
        anchors: [
          {
            id: '1',
            width: 1,
            height: 2,
            depth: 0.5,
            flip: true,
            snappedIds: [snapped.id]
          }
        ]
      })
      const flippable = new FlipBehavior({}, managers)
      snapped.addBehavior(flippable, true)
      expectFlipped(snapped, false)
      expectSnapped(mesh, [snapped], 0)

      await mesh.metadata.unsnap?.(snapped.id)
      expectUnsnapped(mesh, snapped, 0)
      expect(behavior.getSnappedIds()).toEqual([])
      expectFlipped(snapped, false)
      expect(actionRecorded).toHaveBeenCalledOnce()
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped.id, behavior.state.anchors[0].id],
        fromHand: false,
        isLocal: false
      })
      expectMeshFeedback(registerFeedbackSpy, 'unsnap', [0, 0, 0])
    })

    it('unsnaps drawn mesh', async () => {
      const snapped = meshes[1]
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [snapped.id] }
        ]
      })
      expectSnapped(mesh, [snapped], 0)

      await snapped.metadata.draw?.()
      expectUnsnapped(mesh, snapped, 0)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenNthCalledWith(1, {
        fn: 'draw',
        meshId: snapped.id,
        fromHand: false,
        isLocal: false,
        args: []
      })
      expect(actionRecorded).toHaveBeenNthCalledWith(2, {
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped.id, behavior.state.anchors[0].id],
        fromHand: false,
        isLocal: true
      })
      expectMeshFeedback(registerFeedbackSpy, 'unsnap', behavior.zones[0].mesh)
    })

    it('apply gravity when unsnapping from multiple anchor', async () => {
      const [snapped1, snapped2] = meshes
      behavior.fromState({
        anchors: [
          {
            id: '1',
            width: 1,
            height: 2,
            depth: 0.5,
            snappedIds: [snapped1.id, snapped2.id],
            max: 2
          }
        ]
      })
      expectPosition(snapped1, [10, 0.5, 10])
      expectPosition(snapped2, [11, 1.5, 11])
      expectSnapped(mesh, [snapped1, snapped2], 0)

      snapped1.setAbsolutePosition(new Vector3(10, 1, 10))
      managers.move.notifyMove(snapped1)

      expectPosition(snapped2, [11, 0.5, 11])
      expectZoneEnabled(mesh, 0)
      expect(behavior?.snappedZone(snapped1.id)?.mesh.id).toBeUndefined()
      expect(behavior?.snappedZone(snapped2.id)?.mesh.id).toEqual(
        behavior?.zones[0]?.mesh.id
      )
      expect(behavior.getSnappedIds()).toEqual([snapped2.id])
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped1.id, '1'],
        fromHand: false,
        isLocal: false
      })
      expectMeshFeedback(registerFeedbackSpy, 'unsnap', behavior.zones[0].mesh)
    })

    it('unsnaps all', async () => {
      const [snapped1, snapped2] = meshes
      behavior.fromState({
        anchors: [
          {
            id: '1',
            width: 1,
            height: 2,
            depth: 0.5,
            x: -1,
            snappedIds: [snapped1.id]
          },
          { id: '2', width: 1, height: 2, depth: 0.5, snappedIds: [] },
          {
            id: '3',
            width: 1,
            height: 2,
            depth: 0.5,
            x: 1,
            snappedIds: [snapped2.id]
          }
        ]
      })
      expectSnapped(mesh, [snapped1], 0)
      expectSnapped(mesh, [snapped2], 2)

      mesh.metadata.unsnapAll?.()

      expectUnsnapped(mesh, snapped1, 0)
      expectUnsnapped(mesh, snapped2, 2)
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped1.id, '1'],
        fromHand: false,
        isLocal: false
      })
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'unsnap',
        meshId: mesh.id,
        args: [snapped2.id, '3'],
        fromHand: false,
        isLocal: false
      })
      expectMoveRecorded(moveRecorded)
      expectMeshFeedback(
        registerFeedbackSpy,
        'unsnap',
        behavior.zones[0].mesh,
        behavior.zones[2].mesh
      )
    })

    it('keeps rotation when unsnaping rotated mesh', async () => {
      const angle = Math.PI * 0.5
      const snapped = meshes[0]
      snapped.addBehavior(new RotateBehavior({ angle }, managers), true)
      expectRotated(snapped, angle)
      mesh.addBehavior(new RotateBehavior({ angle }, managers), true)
      expectRotated(mesh, angle)
      await mesh.metadata.snap?.(snapped.id, behavior.zones[0].mesh.id)
      expectSnapped(mesh, [snapped])
      registerFeedbackSpy.mockClear()

      mesh.metadata.unsnap?.(snapped.id)
      expectUnsnapped(mesh, snapped, 0)
      expectRotated(mesh, angle)
      expectRotated(snapped, angle)
      expectMeshFeedback(registerFeedbackSpy, 'unsnap', behavior.zones[0].mesh)
    })

    it('can revert unsnapped mesh', async () => {
      const snapped = meshes[0]
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [snapped.id] }
        ]
      })
      expectSnapped(mesh, [snapped], 0)
      expect(behavior.getSnappedIds()).toEqual([snapped.id])
      mesh.metadata.unsnap?.(snapped.id)
      const position = snapped.absolutePosition.asArray()
      expectUnsnapped(mesh, snapped, 0)
      expect(behavior.getSnappedIds()).toEqual([])
      const { args } =
        /** @type {Required<import('@src/3d/managers').RecordedAction>} */ (
          actionRecorded.mock.calls[0][0]
        )
      actionRecorded.mockClear()
      registerFeedbackSpy.mockClear()

      await behavior.revert('unsnap', args)
      expectSnapped(mesh, [snapped], 0)
      expect(behavior.getSnappedIds()).toEqual([snapped.id])
      expect(actionRecorded).toHaveBeenCalledTimes(1)
      expect(actionRecorded).toHaveBeenCalledWith({
        fn: 'snap',
        meshId: mesh.id,
        args: [snapped.id, behavior.zones[0].mesh.id, false],
        duration: behavior.state.duration,
        revert: [snapped.id, position, undefined, undefined],
        fromHand: false,
        isLocal: true
      })
      expectMeshFeedback(registerFeedbackSpy, 'snap', [0, 0, 0])
    })

    it('moves all when dragging current mesh', async () => {
      behavior.fromState({
        anchors: [
          {
            id: '1',
            width: 1,
            height: 2,
            depth: 0.5,
            snappedIds: [meshes[0].id]
          },
          {
            id: '2',
            width: 1,
            height: 2,
            depth: 0.5,
            snappedIds: [meshes[1].id],
            x: 2,
            y: 3,
            z: 1
          }
        ]
      })
      expectSnapped(mesh, meshes.slice(0, 1), 0)
      expectSnapped(mesh, meshes.slice(1, 2), 1)
      expectPosition(meshes[0], [0, getCenterAltitudeAbove(mesh, meshes[0]), 0])
      expectPosition(meshes[1], [2, getCenterAltitudeAbove(mesh, meshes[1]), 1])
      const x = 5
      const y = 3
      const z = 4

      managers.move.notifyMove(mesh)
      animateMove(mesh, new Vector3(x, y, z), null)

      expectPosition(mesh, [x, y, z])
      expectSnapped(mesh, meshes.slice(0, 1), 0)
      expectSnapped(mesh, meshes.slice(1, 2), 1)
      expectPosition(meshes[0], [x, getCenterAltitudeAbove(mesh, meshes[0]), z])
      expectPosition(meshes[1], [
        x + 2,
        getCenterAltitudeAbove(mesh, meshes[1]),
        z + 1
      ])
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
    })

    it('moves all when dragging selection with current mesh', () => {
      behavior.fromState({
        anchors: [
          {
            id: '1',
            width: 1,
            height: 2,
            depth: 0.5,
            snappedIds: [meshes[0].id]
          },
          {
            id: '2',
            width: 1,
            height: 2,
            depth: 0.5,
            snappedIds: [meshes[1].id],
            x: 2,
            y: 3,
            z: 1
          }
        ]
      })
      expectSnapped(mesh, meshes.slice(0, 1), 0)
      expectSnapped(mesh, meshes.slice(1, 2), 1)

      managers.selection.select([mesh, meshes[0]])

      managers.move.notifyMove(mesh)

      expectSnapped(mesh, meshes.slice(0, 1), 0)
      expectSnapped(mesh, meshes.slice(1, 2), 1)
      expect(actionRecorded).not.toHaveBeenCalled()
      expect(registerFeedbackSpy).not.toHaveBeenCalled()
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
      await mesh.metadata.snap?.(meshes[1].id, behavior.zones[1].mesh.id)
      expectSnapped(mesh, meshes.slice(1, 2), 1)
      behavior.disable()

      behavior.enable()
      expectZoneEnabled(mesh, 0)
      expectZoneEnabled(mesh, 1, false)
    })

    it('snaps individual meshes of a selection', async () => {
      const [snapped1, snapped2] = meshes
      behavior.fromState({
        anchors: [
          { id: '1', width: 1, height: 2, depth: 0.5, snappedIds: [] },
          {
            id: '2',
            width: 1,
            height: 2,
            depth: 0.5,
            x: 2,
            y: 3,
            z: 1,
            snappedIds: []
          }
        ]
      })
      expectUnsnapped(mesh, snapped1, 0)
      expectUnsnapped(mesh, snapped2, 1)

      managers.selection.select(meshes)

      await Promise.all([
        mesh.metadata.snap?.(snapped1.id, behavior.zones[0].mesh.id),
        mesh.metadata.snap?.(snapped2.id, behavior.zones[1].mesh.id)
      ])

      expectSnapped(mesh, [snapped1], 0)
      expectSnapped(mesh, [snapped2], 1)
      expect(behavior.getSnappedIds()).toEqual([snapped1.id, snapped2.id])
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expectMoveRecorded(moveRecorded, snapped1, snapped2)
    })

    /**
     * @param {number} rank - actual anchor rank.
     * @param {Partial<import('@tabulous/types').Anchor>} anchor - expected anchor
     * @param {boolean} [isEnabled] - whether this anchor's zone should be enabled, defaults to true.
     * @param {string[]} [kinds] - zone expected kinds, defaults to none.
     * @param {number} [priority] - zone expected priority, defaults to 0.
     */
    function expectAnchor(
      rank,
      { width, height, depth, diameter, x = 0, y = 0, z = 0 },
      isEnabled = true,
      kinds = undefined,
      priority = 0
    ) {
      const zone = behavior.zones[rank]
      expect(zone).toBeDefined()
      expectZoneEnabled(mesh, rank, isEnabled)
      expect(zone.kinds).toEqual(kinds)
      expect(zone.priority).toEqual(priority)
      const { boundingBox } = zone.mesh.getBoundingInfo()
      expect(boundingBox.extendSize.x * 2).toBeCloseTo(diameter ?? width ?? NaN)
      expect(boundingBox.extendSize.y * 2).toBeCloseTo(height ?? NaN)
      expect(boundingBox.extendSize.z * 2).toBeCloseTo(diameter ?? depth ?? NaN)
      expectPosition(zone.mesh, [x, y, z])
    }
  })
})

function makeStack(
  /** @type {import('@src/3d/managers').Managers} */ managers,
  /** @type {import('@babylonjs/core').Mesh} */ mesh
) {
  const stacked = createBox('stacked-box1', {})
  stacked.addBehavior(new AnimateBehavior(), true)
  stacked.addBehavior(new StackBehavior({}, managers), true)
  mesh.addBehavior(
    new StackBehavior({ stackIds: [stacked.id] }, managers),
    true
  )
  managers.control.registerControlable(stacked)
  return stacked
}
