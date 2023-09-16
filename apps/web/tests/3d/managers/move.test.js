// @ts-check
/**
 * @typedef {import('@babylonjs/core').ArcRotateCamera} ArcRotateCamera
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 * @typedef {import('@babylonjs/core').Observer<?>} Observer
 * @typedef {import('@babylonjs/core').Scene} Scene
 * @typedef {import('@src/3d/behaviors/targetable').DropDetails} DropDetails
 * @typedef {import('@src/3d/managers/move').PreMoveDetails} PreMoveDetails
 * @typedef {import('@src/3d/managers/move').MoveDetails} MoveDetails
 * @typedef {import('@src/3d/managers/control').Action} Action
 * @typedef {import('@src/3d/managers/control').Move} Move
 * @typedef {import('@src/3d/managers/target').DropZone} DropZone
 */
/**
 * @template {any[]} P, R
 * @typedef {import('vitest').Mock<P, R>} Mock
 */

import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { faker } from '@faker-js/faker'
import {
  MoveBehavior,
  MoveBehaviorName,
  TargetBehavior
} from '@src/3d/behaviors'
import { StackBehavior } from '@src/3d/behaviors/stackable'
import {
  controlManager,
  handManager,
  indicatorManager,
  inputManager,
  moveManager as manager,
  selectionManager,
  targetManager
} from '@src/3d/managers'
import { createCard } from '@src/3d/meshes'
import { createTable, getDimensions } from '@src/3d/utils'
import {
  afterAll,
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
  createBox,
  expectAnimationEnd,
  expectCloseVector,
  expectMoveRecorded,
  expectPosition,
  sleep
} from '../../test-utils'

describe('MoveManager', () => {
  const centerX = 1024
  const centerY = 512
  const playerId = faker.person.firstName()
  /** @type {Mock<[Move|Action], void>} */
  const actionRecorded = vi.fn()
  /** @type {Mock<[MoveDetails], void>} */
  const moveRecorded = vi.fn()
  /** @type {Mock<[PreMoveDetails], void>} */
  const preMoveRecorded = vi.fn()
  /** @type {Scene} */
  let scene
  /** @type {Scene} */
  let handScene
  /** @type {ArcRotateCamera} */
  let camera
  /** @type {?Observer} */
  let actionObserver
  /** @type {?Observer} */
  let moveObserver
  /** @type {?Observer} */
  let preMoveObserver
  /** @type {DropDetails[]} */
  let drops

  configures3dTestEngine(created => {
    scene = created.scene
    handScene = created.handScene
    camera = created.camera
  })

  beforeAll(() => {
    controlManager.init({ scene, handScene })
    targetManager.init({ scene, color: '#0000ff', playerId })
    indicatorManager.init({ scene })
    actionObserver = controlManager.onActionObservable.add(actionRecorded)
    moveObserver = manager.onMoveObservable.add(moveRecorded)
    preMoveObserver = manager.onPreMoveObservable.add(preMoveRecorded)
  })

  beforeEach(() => {
    vi.clearAllMocks()
    createTable(undefined, scene)
    drops = []
    selectionManager.clear()
  })

  afterAll(() => {
    controlManager.onActionObservable.remove(actionObserver)
    manager.onMoveObservable.remove(moveObserver)
    manager.onMoveObservable.remove(preMoveObserver)
  })

  it('has initial state', () => {
    expect(manager.inProgress).toBe(false)
    expect(manager.elevation).toBeUndefined()
  })

  it('can not continue before start', () => {
    expect(manager.continue({ x: 100, y: 100 }))
    expect(manager.inProgress).toBe(false)
    expectMoveRecorded(moveRecorded)
  })

  it('can not stop before start', () => {
    expect(manager.stop())
    expect(manager.inProgress).toBe(false)
    expectMoveRecorded(moveRecorded)
  })

  it('has no active zones', () => {
    expect(manager.getActiveZones()).toEqual([])
  })

  describe('init()', () => {
    it('assigns properties', () => {
      const elevation = faker.number.int(999)
      manager.init({ scene, elevation })
      expect(manager.inProgress).toBe(false)
      expect(manager.elevation).toBe(elevation)
      expect(manager.scene).toEqual(scene)
    })
  })

  describe('registerMovable()', () => {
    it('registers a mesh', () => {
      const mesh = createBox('box3', {})
      mesh.addBehavior(new MoveBehavior(), true)
      expect(manager.isManaging(mesh)).toBe(true)
    })

    it('automatically unregisters a mesh upon disposal', () => {
      const mesh = createBox('box3', {})
      mesh.addBehavior(new MoveBehavior(), true)
      expect(manager.isManaging(mesh)).toBe(true)

      mesh.dispose()
      expect(manager.isManaging(mesh)).toBe(false)
    })

    it('automatically unregisters a mesh upon behavior detachment', () => {
      const mesh = createBox('box3', {})
      const behavior = new MoveBehavior()
      mesh.addBehavior(behavior, true)
      expect(manager.isManaging(mesh)).toBe(true)

      behavior.detach()
      expect(manager.isManaging(mesh)).toBe(false)
    })

    it('handles invalid behavior', () => {
      const behavior = new MoveBehavior()
      manager.registerMovable(behavior)
      // @ts-expect-error: undefined is not allowed
      manager.registerMovable()
    })
  })

  describe('unregisterMovable()', () => {
    it('handles invalid behavior', () => {
      const behavior = new MoveBehavior()
      manager.unregisterMovable(behavior)
      // @ts-expect-error: undefined is not allowed
      manager.unregisterMovable()
    })

    it('does not unregisters a phantom mesh', () => {
      const mesh = createBox('box3', {})
      mesh.isPhantom = true
      const behavior = new MoveBehavior()
      mesh.addBehavior(behavior, true)
      expect(manager.isManaging(mesh)).toBe(true)

      mesh.dispose()
      expect(manager.isManaging(mesh)).toBe(true)
    })
  })

  describe('given single mesh', () => {
    /** @type {Mesh} */
    let moved
    /** @type {Mesh[]} */
    let targets

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = createMovable()
      targets = [
        createsTarget(1, new Vector3(3, 0, 0)),
        createsTarget(2, new Vector3(-1, 0, -4.1))
      ]
    })

    describe('start()', () => {
      it('ignores uncontrolled mesh', () => {
        const mesh = createBox('box4', {})
        manager.start(mesh, { x: centerX, y: centerY })
        expect(manager.inProgress).toBe(false)
        expect(manager.isMoving(mesh)).toBe(false)
        expectMoveRecorded(moveRecorded)
        expect(preMoveRecorded).not.toHaveBeenCalled()
      })

      it('ignores disabled mesh', () => {
        const mesh = createBox('box4', {})
        const behavior = new MoveBehavior()
        mesh.addBehavior(behavior, true)
        behavior.enabled = false

        manager.start(mesh, { x: centerX, y: centerY })
        expect(manager.inProgress).toBe(false)
        expect(manager.isMoving(mesh)).toBe(false)
        expectMoveRecorded(moveRecorded)
        expect(preMoveRecorded).not.toHaveBeenCalled()
      })

      it('elevates moved mesh', () => {
        const prev = moved.absolutePosition.asArray()
        manager.start(moved, { x: centerX, y: centerY })
        expect(manager.inProgress).toBe(true)
        expect(manager.isMoving(moved)).toBe(true)
        expectPosition(moved, [1, 1 + manager.elevation, 1])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved.id,
            pos: moved.absolutePosition.asArray(),
            prev,
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expectMoveRecorded(moveRecorded, moved)
        expect(preMoveRecorded).toHaveBeenCalledTimes(1)
        expect(
          preMoveRecorded.mock.calls[0][0].meshes.map(({ id }) => id)
        ).toEqual([moved.id])
      })

      it('can change moved mesh', () => {
        const moved2 = createMovable('box2')
        const prev = moved2.absolutePosition.asArray()
        expect(selectionManager.meshes.has(moved2)).toBe(false)
        manager.onPreMoveObservable.addOnce(({ meshes }) => {
          meshes.splice(0, meshes.length, moved2)
        })
        manager.start(moved, { x: centerX, y: centerY })
        expect(manager.inProgress).toBe(true)
        expect(manager.isMoving(moved)).toBe(false)
        expect(manager.isMoving(moved2)).toBe(true)
        expect(selectionManager.meshes.has(moved2)).toBe(true)
        expectPosition(moved, [1, 1, 1])
        expectPosition(moved2, [1, 1 + manager.elevation, 1])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved2.id,
            pos: moved2.absolutePosition.asArray(),
            prev,
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expectMoveRecorded(moveRecorded, moved2)
        expect(preMoveRecorded).toHaveBeenCalledTimes(1)
        expect(
          preMoveRecorded.mock.calls[0][0].meshes.map(({ id }) => id)
        ).toEqual([moved2.id])
      })
    })

    describe('continue()', () => {
      /** @type {number[]} */
      let prev

      beforeEach(() => {
        manager.start(moved, { x: centerX, y: centerY })
        actionRecorded.mockReset()
        moveRecorded.mockReset()
        expect(selectionManager.meshes.has(moved)).toBe(true)
        prev = moved.absolutePosition.asArray()
      })

      it('updates moved mesh position', () => {
        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207
        manager.continue({ x: centerX + 50, y: centerY + 50 })
        expect(manager.isMoving(moved)).toBe(true)
        expectPosition(moved, [1 + deltaX, 1 + manager.elevation, 1 + deltaZ])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved.id,
            pos: moved.absolutePosition.asArray(),
            prev,
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(manager.getActiveZones()).toHaveLength(0)
        expectMoveRecorded(moveRecorded)
      })

      it('updates possible targets', () => {
        manager.continue({ x: centerX + 50, y: centerY + 20 })
        expect(manager.getActiveZones()).toHaveLength(1)
        expectZoneForMeshes(targets[0].id, [moved])

        manager.continue({ x: centerX - 50, y: centerY + 120 })
        expect(manager.getActiveZones()).toHaveLength(1)
        expectZoneForMeshes(targets[1].id, [moved])
      })

      it('elevates moved when detecting a collision', () => {
        const obstacle = createBox('obstacle', { size: 2 })
        obstacle.setAbsolutePosition(new Vector3(1, 0.5, 1))

        manager.continue({ x: centerX + 20, y: centerY })
        expectPosition(moved, [
          1.8257662057876587,
          getAltitudeOnCollision(moved, obstacle),
          1
        ])
      })

      it('elevates moved mesh above stacked obstacles', () => {
        const obstacle1 = createBox('obstacle1', {})
        obstacle1.setAbsolutePosition(new Vector3(1, 0.5, 1))
        const obstacle2 = createBox('obstacle2', {})
        obstacle2.setAbsolutePosition(new Vector3(1, 2, 1))
        const obstacle3 = createBox('obstacle3', {})
        obstacle3.setAbsolutePosition(new Vector3(1, 3.5, 1))

        manager.continue({ x: centerX + 20, y: centerY })
        expectPosition(moved, [
          1.8257662057876587,
          getAltitudeOnCollision(moved, obstacle3),
          1
        ])
      })

      it('stops when pointer is leaving table', async () => {
        manager.continue({ x: centerX * 100, y: centerY * 100 })
        await expectAnimationEnd(moved.getBehaviorByName(MoveBehaviorName))
        await sleep()
        expectPosition(moved, [1, getDimensions(moved).height / 2, 1])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved.id,
            pos: moved.absolutePosition.asArray(),
            prev,
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(manager.getActiveZones()).toHaveLength(0)
        expect(manager.inProgress).toBe(false)
        expectMoveRecorded(moveRecorded)
        expect(selectionManager.meshes.has(moved)).toBe(false)
      })
    })

    describe('stop()', () => {
      /** @type {number[]} */
      let prev

      beforeEach(() => {
        manager.start(moved, { x: centerX, y: centerY })
        actionRecorded.mockReset()
        moveRecorded.mockReset()
        expect(selectionManager.meshes.has(moved)).toBe(true)
        prev = moved.absolutePosition.asArray()
      })

      it('descends moved mesh', async () => {
        await manager.stop()
        expect(manager.isMoving(moved)).toBe(false)
        expectPosition(moved, [1, getDimensions(moved).height / 2, 1])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved.id,
            pos: moved.absolutePosition.asArray(),
            prev,
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(manager.getActiveZones()).toHaveLength(0)
        expect(manager.inProgress).toBe(false)
        expect(drops).toHaveLength(0)
        expectMoveRecorded(moveRecorded)
        expect(selectionManager.meshes.has(moved)).toBe(false)
      })

      it('drops moved mesh to active target', async () => {
        const deltaX = 2.050389051437378
        const deltaZ = -0.8877299800515175
        manager.continue({ x: centerX + 50, y: centerY + 20 })
        expect(manager.getActiveZones()).toHaveLength(1)
        expectZoneForMeshes(targets[0].id, [moved])

        await manager.stop()
        expect(manager.isMoving(moved)).toBe(false)
        expectPosition(moved, [
          1 + deltaX,
          moved.absolutePosition.y,
          1 + deltaZ
        ])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved.id,
            pos: moved.absolutePosition.asArray(),
            prev,
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(manager.getActiveZones()).toHaveLength(0)
        expect(manager.inProgress).toBe(false)
        expect(drops).toHaveLength(1)
        expectDroppedEvent(0, targets[0], [moved])
        expectMoveRecorded(moveRecorded)
        expect(selectionManager.meshes.has(moved)).toBe(false)
      })

      it('disables other operations', async () => {
        await manager.stop()
        manager.continue({ x: 0, y: 0 })
        await manager.stop()
        expectPosition(moved, [1, getDimensions(moved).height / 2, 1])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved.id,
            pos: moved.absolutePosition.asArray(),
            prev,
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(manager.inProgress).toBe(false)
        expect(drops).toHaveLength(0)
        expect(manager.getActiveZones()).toHaveLength(0)
      })
    })
  })

  describe('given a mesh in hand', () => {
    /** @type {Mesh} */
    let moved
    /** @type {Vector3} */
    let cameraPosition
    /** @type {number[]} */
    let prev

    const handOverlay = document.createElement('div')
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      () =>
        /** @type {CSSStyleDeclaration} */ ({
          height: `${centerY / 2}px`
        })
    )

    beforeAll(() => {
      manager.init({ scene })
      handManager.init({ scene, handScene, playerId, overlay: handOverlay })
      cameraPosition = camera.position.clone()
    })

    beforeEach(() => {
      moved = createCard(
        { id: 'box', texture: '', x: 1, y: 1, z: 1, drawable: {}, movable: {} },
        handScene
      )
      camera.setPosition(cameraPosition)
      prev = moved.absolutePosition.asArray()
    })

    it('moves according to hand camera', async () => {
      const camera = /** @type {ArcRotateCamera} */ (scene.activeCamera)
      camera.setPosition(new Vector3(10, 0, 0))
      manager.start(moved, { x: centerX, y: centerY })
      expect(manager.inProgress).toBe(true)
      expectPosition(moved, [1, 1 + manager.elevation, 1])

      const deltaX = 2.029703140258789
      const deltaZ = -2.196934700012207
      manager.continue({ x: centerX + 50, y: centerY + 50 })

      expectPosition(moved, [1 + deltaX, 1 + manager.elevation, 1 + deltaZ])

      await manager.stop()
      expectPosition(moved, [3, getDimensions(moved).height / 2, -1.25])
      expect(manager.inProgress).toBe(false)
      expect(drops).toHaveLength(0)
      expectMoveRecorded(moveRecorded, moved)
    })

    it('keeps moving mesh after drawn', async () => {
      let event = { x: centerX, y: centerY }
      manager.start(moved, event)
      expect(manager.inProgress).toBe(true)
      expect(selectionManager.meshes.has(moved)).toBe(true)
      const y = 1 + manager.elevation
      expectPosition(moved, [1, y, 1])

      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        mesh: moved,
        button: 1,
        timestamp: Date.now(),
        pointers: 1,
        event: /** @type {PointerEvent} */ (event)
      })
      const deltaX = 2.029703219946068
      const deltaZ = -2.1969471586981797
      event = { x: centerX + 50, y: centerY + 50 }
      inputManager.onDragObservable.notifyObservers({
        type: 'drag',
        mesh: moved,
        button: 1,
        timestamp: Date.now(),
        pointers: 1,
        event: /** @type {PointerEvent} */ (event)
      })
      await sleep()
      manager.continue(event)

      const mainMoved = /** @type {Mesh} */ (scene.getMeshById(moved.id))
      expect(mainMoved).not.toBeNull()
      expectPosition(mainMoved, [deltaX, y, deltaZ])
      expect(manager.inProgress).toBe(true)
      expect(drops).toHaveLength(0)

      manager.stop()

      expect(actionRecorded).toHaveBeenNthCalledWith(
        1,
        {
          meshId: moved.id,
          pos: [1, 1 + manager.elevation, 1],
          prev,
          fromHand: true
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenNthCalledWith(
        2,
        {
          meshId: moved.id,
          fn: 'play',
          args: [expect.anything(), playerId],
          fromHand: false,
          isLocal: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenNthCalledWith(
        3,
        {
          meshId: moved.id,
          pos: expect.any(Array),
          prev: [0, y, expect.numberCloseTo(-0.00001, 4)],
          fromHand: false
        },
        expect.anything()
      )
      expectCloseVector(
        Vector3.FromArray(
          /** @type {Move} */ (actionRecorded.mock.calls[2][0]).pos
        ),
        [deltaX, y, deltaZ]
      )
      expect(actionRecorded).toHaveBeenCalledTimes(3)
      expect(manager.getActiveZones()).toHaveLength(0)
      expectMoveRecorded(moveRecorded, moved)
      expect(selectionManager.meshes.has(moved)).toBe(false)
      expect(selectionManager.meshes.has(mainMoved)).toBe(false)
    })

    it(
      'excludes selected meshes from main scene when moving hand mesh',
      async () => {
        const positions = [new Vector3(0, 5, 0), new Vector3(-3, 0, -3)]
        const meshes = [
          createMovable('box1', positions[0]),
          createMovable('box2', positions[1])
        ]
        selectionManager.select([...meshes, moved])

        manager.start(moved, { x: centerX, y: centerY })
        expect(manager.inProgress).toBe(true)
        expectPosition(moved, [1, 1 + manager.elevation, 1])

        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207
        manager.continue({ x: centerX + 50, y: centerY + 50 })

        expectPosition(moved, [1 + deltaX, 1 + manager.elevation, 1 + deltaZ])

        await manager.stop()
        expectPosition(moved, [3, getDimensions(moved).height / 2, -1.25])
        expect(manager.inProgress).toBe(false)
        expect(drops).toHaveLength(0)
        expectPosition(meshes[0], positions[0].asArray())
        expectPosition(meshes[1], positions[1].asArray())
        expectMoveRecorded(moveRecorded, moved)
      },
      { retry: 3 }
    )
  })

  describe('given active selection', () => {
    /** @type {Mesh[]} */
    let moved
    /** @type {Mesh[]} */
    let targets
    /** @type {(number[])[]} */
    let prevs

    beforeAll(() => manager.init({ scene }))

    function updatePrevs() {
      prevs = moved.map(mesh => mesh.absolutePosition.asArray())
    }

    beforeEach(() => {
      moved = [
        createMovable(),
        createMovable('box1', new Vector3(0, 5, 0)),
        createMovable('box2', new Vector3(-3, 0.5, -3))
      ]
      selectionManager.select(moved)
      targets = [
        createsTarget(1, new Vector3(3, 0, 0)),
        createsTarget(2, new Vector3(-1, 0, -4.1))
      ]
      updatePrevs()
    })

    describe('start()', () => {
      it('elevates entire selection', () => {
        manager.start(moved[1], { x: centerX, y: centerY })
        expect(manager.isMoving(moved[0])).toBe(true)
        expect(manager.isMoving(moved[1])).toBe(true)
        expect(manager.isMoving(moved[2])).toBe(true)
        expect(selectionManager.meshes.has(moved[0])).toBe(true)
        expect(selectionManager.meshes.has(moved[1])).toBe(true)
        expect(selectionManager.meshes.has(moved[2])).toBe(true)
        expectPosition(moved[0], [1, 1 + manager.elevation, 1])
        expectPosition(moved[1], [0, 5 + manager.elevation, 0])
        expectPosition(moved[2], [-3, 0.5 + manager.elevation, -3])
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: moved[2].id,
            pos: moved[2].absolutePosition.asArray(),
            prev: prevs[2],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: moved[0].id,
            pos: moved[0].absolutePosition.asArray(),
            prev: prevs[0],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          3,
          {
            meshId: moved[1].id,
            pos: moved[1].absolutePosition.asArray(),
            prev: prevs[1],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(moved.length)
        expect(manager.getActiveZones()).toHaveLength(0)
        expectMoveRecorded(moveRecorded, moved[2], moved[0], moved[1])
        expect(preMoveRecorded).toHaveBeenCalledTimes(1)
        expect(
          preMoveRecorded.mock.calls[0][0].meshes.map(({ id }) => id)
        ).toEqual([moved[2].id, moved[0].id, moved[1].id])
      })

      it('ignores disabled, selected mesh', () => {
        const behavior = new MoveBehavior()
        moved[2].addBehavior(behavior, true)
        behavior.enabled = false

        manager.start(moved[1], { x: centerX, y: centerY })
        expect(manager.isMoving(moved[0])).toBe(true)
        expect(manager.isMoving(moved[1])).toBe(true)
        expect(manager.isMoving(moved[2])).toBe(false)
        expectPosition(moved[0], [1, 1 + manager.elevation, 1])
        expectPosition(moved[1], [0, 5 + manager.elevation, 0])
        expectPosition(moved[2], [-3, 0.5, -3])
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: moved[0].id,
            pos: moved[0].absolutePosition.asArray(),
            prev: prevs[0],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: moved[1].id,
            pos: moved[1].absolutePosition.asArray(),
            prev: prevs[1],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(2)
        expect(manager.getActiveZones()).toHaveLength(0)
        expectMoveRecorded(moveRecorded, moved[0], moved[1])
      })
    })

    describe('continue()', () => {
      beforeEach(() => {
        manager.start(moved[0], { x: centerX, y: centerY })
        actionRecorded.mockReset()
        moveRecorded.mockReset()
      })

      it('moves entire selection, ordered by elevation', () => {
        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207
        updatePrevs()

        manager.continue({ x: centerX + 50, y: centerY + 50 })
        expectPosition(moved[0], [
          1 + deltaX,
          1 + manager.elevation,
          1 + deltaZ
        ])
        expectPosition(moved[1], [deltaX, 5 + manager.elevation, deltaZ])
        expectPosition(moved[2], [
          -3 + deltaX,
          0.5 + manager.elevation,
          -3 + deltaZ
        ])
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: moved[2].id,
            pos: moved[2].absolutePosition.asArray(),
            prev: prevs[2],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: moved[0].id,
            pos: moved[0].absolutePosition.asArray(),
            prev: prevs[0],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          3,
          {
            meshId: moved[1].id,
            pos: moved[1].absolutePosition.asArray(),
            prev: prevs[1],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(moved.length)
        expect(manager.getActiveZones()).toHaveLength(0)
        expectMoveRecorded(moveRecorded)
      })

      it('updates target for individual selected meshes', () => {
        manager.continue({ x: centerX + 50, y: centerY + 20 })
        expect(manager.getActiveZones()).toHaveLength(2)
        expectZoneForMeshes(targets[0].id, [moved[0]])
        expectZoneForMeshes(targets[1].id, [moved[2]])

        manager.continue({ x: centerX + 50, y: centerY + 35 })
        expect(manager.getActiveZones()).toHaveLength(1)
        expectZoneForMeshes(targets[1].id, [moved[2]])
      })

      it('elevates entire selection on collision', () => {
        const deltaX = 0.8257662057876587
        const obstacle1 = createBox('obstacle1', { size: 2 })
        obstacle1.setAbsolutePosition(new Vector3(1, 0.5, 1))
        const obstacle2 = createBox('obstacle2', { size: 2 })
        obstacle2.setAbsolutePosition(new Vector3(-10, 0, -10))

        manager.continue({ x: centerX + 20, y: centerY })
        expectPosition(moved[0], [
          1 + deltaX,
          getAltitudeOnCollision(moved[0], obstacle1, 0.5),
          1
        ])
        expectPosition(moved[1], [
          deltaX,
          getAltitudeOnCollision(moved[1], obstacle1, 4.5),
          0
        ])
        expectPosition(moved[2], [
          -3 + deltaX,
          getAltitudeOnCollision(moved[2], obstacle1, 0),
          -3
        ])
      })

      it('does not checks collision within selection', () => {
        moved[0].setAbsolutePosition(new Vector3(-2.5, manager.elevation, -2.5))
        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207

        manager.continue({ x: centerX + 50, y: centerY + 50 })
        expectPosition(moved[0], [
          -2.5 + deltaX,
          manager.elevation,
          -2.5 + deltaZ
        ])
        expectPosition(moved[1], [deltaX, 5 + manager.elevation, deltaZ])
        expectPosition(moved[2], [
          -3 + deltaX,
          0.5 + manager.elevation,
          -3 + deltaZ
        ])
      })
    })

    describe('exclude()', () => {
      it('removes mesh from selection', () => {
        manager.start(moved[0], { x: centerX, y: centerY })
        expect(manager.isMoving(moved[0])).toBe(true)
        expect(manager.isMoving(moved[1])).toBe(true)
        expect(manager.isMoving(moved[2])).toBe(true)
        actionRecorded.mockReset()

        manager.exclude(moved[0], moved[2])
        expect(manager.isMoving(moved[0])).toBe(false)
        expect(manager.isMoving(moved[1])).toBe(true)
        expect(manager.isMoving(moved[2])).toBe(false)

        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207

        const prev = moved[1].absolutePosition.asArray()
        manager.continue({ x: centerX + 50, y: centerY + 50 })
        expectPosition(moved[0], [1, 1.5, 1])
        expectPosition(moved[1], [deltaX, 5 + manager.elevation, deltaZ])
        expectPosition(moved[2], [-3, 0.5 + manager.elevation, -3])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved[1].id,
            pos: moved[1].absolutePosition.asArray(),
            prev,
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(manager.getActiveZones()).toHaveLength(0)
        expect(selectionManager.meshes.has(moved[0])).toBe(true)
        expect(selectionManager.meshes.has(moved[1])).toBe(true)
        expect(selectionManager.meshes.has(moved[2])).toBe(true)
      })

      it('ignores unknow meshes', () => {
        selectionManager.clear()
        selectionManager.select(moved.slice(0, 2))
        manager.start(moved[1], { x: centerX, y: centerY })
        actionRecorded.mockReset()

        manager.exclude(moved[2])

        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207

        updatePrevs()
        manager.continue({ x: centerX + 50, y: centerY + 50 })
        expectPosition(moved[0], [
          1 + deltaX,
          1 + manager.elevation,
          1 + deltaZ
        ])
        expectPosition(moved[1], [deltaX, 5 + manager.elevation, deltaZ])
        expectPosition(moved[2], [-3, 0.5, -3])
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: moved[0].id,
            pos: moved[0].absolutePosition.asArray(),
            prev: prevs[0],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: moved[1].id,
            pos: moved[1].absolutePosition.asArray(),
            prev: prevs[1],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(2)
        expect(manager.getActiveZones()).toHaveLength(0)
      })
    })

    describe('include()', () => {
      it('adds new mesh from selection', () => {
        selectionManager.unselect(moved.slice(1))
        manager.start(moved[0], { x: centerX, y: centerY })
        expect(manager.isMoving(moved[0])).toBe(true)
        expect(manager.isMoving(moved[1])).toBe(false)
        expect(manager.isMoving(moved[2])).toBe(false)
        expect(selectionManager.meshes.has(moved[0])).toBe(true)
        expect(selectionManager.meshes.has(moved[1])).toBe(false)
        expect(selectionManager.meshes.has(moved[2])).toBe(false)
        actionRecorded.mockReset()

        manager.include(moved[1], moved[2])
        expect(manager.isMoving(moved[0])).toBe(true)
        expect(manager.isMoving(moved[1])).toBe(true)
        expect(manager.isMoving(moved[2])).toBe(true)
        expect(selectionManager.meshes.has(moved[0])).toBe(true)
        expect(selectionManager.meshes.has(moved[1])).toBe(true)
        expect(selectionManager.meshes.has(moved[2])).toBe(true)

        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207

        const prevs2 = moved.map(mesh => mesh.absolutePosition.asArray())
        manager.continue({ x: centerX + 50, y: centerY + 50 })
        expectPosition(moved[0], [
          deltaX + 1,
          1 + manager.elevation,
          deltaZ + 1
        ])
        expectPosition(moved[1], [deltaX, 5 + manager.elevation, deltaZ])
        expectPosition(moved[2], [
          deltaX - 3,
          0.5 + manager.elevation,
          deltaZ - 3
        ])
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: moved[1].id,
            pos: [0, 5 + manager.elevation, 0],
            prev: prevs[1],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: moved[2].id,
            pos: [-3, 0.5 + manager.elevation, -3],
            prev: prevs[2],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          3,
          {
            meshId: moved[0].id,
            pos: moved[0].absolutePosition.asArray(),
            prev: prevs2[0],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          4,
          {
            meshId: moved[1].id,
            pos: moved[1].absolutePosition.asArray(),
            prev: prevs2[1],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          5,
          {
            meshId: moved[2].id,
            pos: moved[2].absolutePosition.asArray(),
            prev: prevs2[2],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(5)
        expect(manager.getActiveZones()).toHaveLength(0)
      })

      it('ignores already selected meshes', () => {
        manager.start(moved[0], { x: centerX, y: centerY })
        actionRecorded.mockReset()

        manager.include(moved[0], moved[1])

        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207

        updatePrevs()
        manager.continue({ x: centerX + 50, y: centerY + 50 })
        expectPosition(moved[0], [
          deltaX + 1,
          1 + manager.elevation,
          deltaZ + 1
        ])
        expectPosition(moved[1], [deltaX, 5 + manager.elevation, deltaZ])
        expectPosition(moved[2], [
          deltaX - 3,
          0.5 + manager.elevation,
          deltaZ - 3
        ])
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: moved[2].id,
            pos: moved[2].absolutePosition.asArray(),
            prev: prevs[2],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: moved[0].id,
            pos: moved[0].absolutePosition.asArray(),
            prev: prevs[0],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          3,
          {
            meshId: moved[1].id,
            pos: moved[1].absolutePosition.asArray(),
            prev: prevs[1],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(3)
        expect(manager.getActiveZones()).toHaveLength(0)
      })
    })

    describe('stop()', () => {
      beforeEach(() => {
        manager.start(moved[0], { x: centerX, y: centerY })
        actionRecorded.mockReset()
        moveRecorded.mockReset()
        expect(selectionManager.meshes.has(moved[0])).toBe(true)
        expect(selectionManager.meshes.has(moved[1])).toBe(true)
        expect(selectionManager.meshes.has(moved[2])).toBe(true)
      })

      it('drops relevant meshes on their target and move others', async () => {
        const deltaX = 2.050389051437378
        const deltaZ = -0.8877299800515175
        manager.continue({ x: centerX + 50, y: centerY + 20 })
        expect(manager.getActiveZones()).toHaveLength(2)
        expectZoneForMeshes(targets[0].id, [moved[0]])
        expectZoneForMeshes(targets[1].id, [moved[2]])
        const prev = moved[1].absolutePosition.asArray()
        actionRecorded.mockReset()

        await manager.stop()
        expect(manager.isMoving(moved[0])).toBe(false)
        expect(manager.isMoving(moved[1])).toBe(false)
        expect(manager.isMoving(moved[2])).toBe(false)
        expectPosition(moved[0], [
          1 + deltaX,
          moved[0].absolutePosition.y,
          1 + deltaZ
        ])
        const pos = [2, getDimensions(moved[1]).height / 2, -1]
        expectPosition(moved[1], pos)
        expectPosition(moved[2], [
          -3 + deltaX,
          moved[2].absolutePosition.y,
          -3 + deltaZ
        ])
        expect(manager.getActiveZones()).toHaveLength(0)
        expect(manager.inProgress).toBe(false)
        expect(drops).toHaveLength(2)
        expectDroppedEvent(0, targets[1], [moved[2]])
        expectDroppedEvent(1, targets[0], [moved[0]])
        expectMoveRecorded(moveRecorded)
        expect(selectionManager.meshes.has(moved[0])).toBe(true)
        expect(selectionManager.meshes.has(moved[1])).toBe(true)
        expect(selectionManager.meshes.has(moved[2])).toBe(true)

        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          { meshId: moved[1].id, pos, prev, fromHand: false },
          expect.anything()
        )
      })
    })
  })

  describe('given parent and active selection', () => {
    /** @type {Mesh[]} */
    let moved

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = [
        createMovable(),
        createMovable('box1', new Vector3(0, 5, 0)),
        createMovable('box2', new Vector3(-3, 0.5, -3))
      ]
      moved[1].setParent(moved[0])
      moved[2].setParent(moved[1])
      selectionManager.select([moved[0], moved[1]])
    })

    describe('start()', () => {
      it('elevates unselected children mesh', () => {
        const prev = moved[0].absolutePosition.asArray()
        manager.start(moved[1], { x: centerX, y: centerY })
        expectPosition(moved[0], [1, 1 + manager.elevation, 1])
        expectPosition(moved[1], [0, 5 + manager.elevation, 0])
        expectPosition(moved[2], [-3, 0.5 + manager.elevation, -3])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved[0].id,
            pos: moved[0].absolutePosition.asArray(),
            prev,
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(manager.getActiveZones()).toHaveLength(0)
        expectMoveRecorded(moveRecorded, moved[0])
      })
    })

    describe('continue()', () => {
      beforeEach(() => {
        manager.start(moved[1], { x: centerX, y: centerY })
        actionRecorded.mockReset()
      })

      it('moves selection and their children', () => {
        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207

        const prev = moved[0].absolutePosition.asArray()
        manager.continue({ x: centerX + 50, y: centerY + 50 })
        expectPosition(moved[0], [
          1 + deltaX,
          1 + manager.elevation,
          1 + deltaZ
        ])
        expectPosition(moved[1], [deltaX, 5 + manager.elevation, deltaZ])
        expectPosition(moved[2], [
          -3 + deltaX,
          0.5 + manager.elevation,
          -3 + deltaZ
        ])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved[0].id,
            pos: [3.029703219946068, 1.5, -1.19693470331012],
            prev,
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(manager.getActiveZones()).toHaveLength(0)
      })
    })
  })

  describe('given a stack of meshes', () => {
    /** @type {Mesh[]} */
    let moved
    /** @type {(number[])[]} */
    let prevs

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = [
        createMovable(),
        createMovable('box1', new Vector3(0, 5, 0)),
        createMovable('box2', new Vector3(-3, 0.5, -3))
      ].map(movable => {
        movable.addBehavior(new StackBehavior(), true)
        return movable
      })
      moved[0].metadata.push?.(moved[1].id, true)
      moved[0].metadata.push?.(moved[2].id, true)
      actionRecorded.mockClear()
      moveRecorded.mockClear()
      prevs = moved.map(mesh => mesh.absolutePosition.asArray())
    })

    afterEach(() => manager.stop())

    it('can move highest mesh', () => {
      manager.start(moved[2], { x: centerX, y: centerY })
      expectPosition(moved[0], [1, 1, 1])
      expectPosition(moved[1], [1, 2, 1])
      expectPosition(moved[2], [1, 3 + manager.elevation, 1])
      expect(actionRecorded).toHaveBeenNthCalledWith(
        1,
        {
          meshId: moved[2].id,
          pos: moved[2].absolutePosition.asArray(),
          prev: prevs[2],
          fromHand: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenNthCalledWith(
        2,
        {
          meshId: moved[0].id,
          fn: 'pop',
          args: [1, false],
          revert: [[moved[2].id], false],
          fromHand: false,
          isLocal: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenCalledTimes(2)
      expectMoveRecorded(moveRecorded, moved[2])
    })

    it('can not move base mesh', () => {
      manager.start(moved[0], { x: centerX, y: centerY })
      expectPosition(moved[0], [1, 1, 1])
      expectPosition(moved[1], [1, 2, 1])
      expectPosition(moved[2], [1, 3, 1])
      expect(actionRecorded).not.toHaveBeenCalled()
      expectMoveRecorded(moveRecorded)
    })

    it('can not intermediate mesh', () => {
      manager.start(moved[1], { x: centerX, y: centerY })
      expectPosition(moved[0], [1, 1, 1])
      expectPosition(moved[1], [1, 2, 1])
      expectPosition(moved[2], [1, 3, 1])
      expect(actionRecorded).not.toHaveBeenCalled()
      expectMoveRecorded(moveRecorded)
    })

    describe('given the entire stack is selected', () => {
      beforeEach(() => selectionManager.select(moved))

      it.each([
        { title: 'highest mesh', rank: 2 },
        { title: 'intermediate mesh', rank: 1 },
        { title: 'base mesh', rank: 0 }
      ])('moves entire stack from $title', ({ rank }) => {
        manager.start(moved[rank], { x: centerX, y: centerY })
        expectPosition(moved[0], [1, 1 + manager.elevation, 1])
        expectPosition(moved[1], [1, 2 + manager.elevation, 1])
        expectPosition(moved[2], [1, 3 + manager.elevation, 1])
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: moved[0].id,
            pos: moved[0].absolutePosition.asArray(),
            prev: prevs[0],
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expectMoveRecorded(moveRecorded, moved[0])
      })
    })
  })

  function createMovable(
    id = 'box',
    position = new Vector3(1, 1, 1),
    sceneUsed = scene
  ) {
    const movable = createBox(id, {}, sceneUsed)
    movable.setAbsolutePosition(position)
    movable.addBehavior(new MoveBehavior(), true)
    controlManager.registerControlable(movable)
    return movable
  }

  function createsTarget(rank = 1, position = new Vector3(0, 0, 0)) {
    const targetable = createBox(`targetable-${rank}`, {})
    targetable.isHittable = false
    const behavior = new TargetBehavior()
    behavior.onDropObservable.add(drop => drops.push(drop))
    targetable.addBehavior(behavior, true)

    const target = createBox(`target-${rank}`, { height: 0.1 })
    target.setAbsolutePosition(position)
    behavior.addZone(target, { extent: 0.5 })
    return target
  }

  function expectDroppedEvent(
    /** @type {number} */ rank,
    /** @type {Mesh} */ target,
    /** @type {Mesh[]} */ moved
  ) {
    expect(drops[rank]?.zone.mesh.id).toEqual(target.id)
    expect(getIds(drops[rank]?.dropped)).toEqual(getIds(moved))
  }
})

function expectZoneForMeshes(
  /** @type {string} */ targetId,
  /** @type {Mesh[]} */ meshes
) {
  const zone = /** @type {DropZone}) */ (
    manager.getActiveZones().find(({ mesh }) => mesh.id === targetId)
  )
  expect(zone).toBeDefined()
  expect(getIds(targetManager.droppablesByDropZone.get(zone))).toEqual(
    getIds(meshes)
  )
}

function getAltitudeOnCollision(
  /** @type {Mesh} */ moved,
  /** @type {Mesh} */ obstacle,
  offset = 0
) {
  return (
    obstacle.getBoundingInfo().boundingBox.maximumWorld.y +
    getDimensions(moved).height * 0.5 +
    offset +
    manager.elevation
  )
}

function getIds(/** @type {Mesh[]} */ meshes = []) {
  return meshes.map(({ id }) => id)
}
