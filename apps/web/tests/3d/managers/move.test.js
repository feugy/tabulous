import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { faker } from '@faker-js/faker'
import {
  configures3dTestEngine,
  expectAnimationEnd,
  expectMoveRecorded,
  expectPosition,
  sleep
} from '../../test-utils'
import {
  MoveBehavior,
  MoveBehaviorName,
  StackBehavior,
  TargetBehavior
} from '../../../src/3d/behaviors'
import {
  controlManager,
  handManager,
  inputManager,
  moveManager as manager,
  selectionManager,
  targetManager
} from '../../../src/3d/managers'
import { createCard } from '../../../src/3d/meshes'
import { createTable, getDimensions } from '../../../src/3d/utils'

describe('MoveManager', () => {
  const centerX = 1024
  const centerY = 512
  const actionRecorded = jest.fn()
  const moveRecorded = jest.fn()
  let scene
  let handScene
  let camera
  let actionObserver
  let moveObserver
  let drops

  configures3dTestEngine(created => {
    scene = created.scene
    handScene = created.handScene
    camera = created.camera
  })

  beforeAll(() => {
    controlManager.init({ scene, handScene })
    targetManager.init({ scene })
    actionObserver = controlManager.onActionObservable.add(actionRecorded)
    moveObserver = manager.onMoveObservable.add(moveRecorded)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    createTable()
    drops = []
    selectionManager.clear()
  })

  afterAll(() => {
    controlManager.onActionObservable.remove(actionObserver)
    moveObserver = manager.onMoveObservable.remove(moveObserver)
  })

  it('has initial state', () => {
    expect(manager.inProgress).toBe(false)
    expect(manager.elevation).toBeNull()
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
      const elevation = faker.datatype.number()
      manager.init({ scene, elevation })
      expect(manager.inProgress).toBe(false)
      expect(manager.elevation).toBe(elevation)
      expect(manager.scene).toEqual(scene)
    })
  })

  describe('registerMovable()', () => {
    it('registers a mesh', () => {
      const mesh = CreateBox('box3', {})
      mesh.addBehavior(new MoveBehavior(), true)
      expect(manager.isManaging(mesh)).toBe(true)
    })

    it('automatically unregisters a mesh upon disposal', () => {
      const mesh = CreateBox('box3', {})
      mesh.addBehavior(new MoveBehavior(), true)
      expect(manager.isManaging(mesh)).toBe(true)

      mesh.dispose()
      expect(manager.isManaging(mesh)).toBe(false)
    })

    it('automatically unregisters a mesh upon behavior detachment', () => {
      const mesh = CreateBox('box3', {})
      const behavior = new MoveBehavior()
      mesh.addBehavior(behavior, true)
      expect(manager.isManaging(mesh)).toBe(true)

      behavior.detach()
      expect(manager.isManaging(mesh)).toBe(false)
    })

    it('handles invalid behavior', () => {
      const behavior = new MoveBehavior()
      manager.registerMovable(behavior)
      manager.registerMovable()
    })
  })

  describe('unregisterMovable()', () => {
    it('handles invalid behavior', () => {
      const behavior = new MoveBehavior()
      manager.unregisterMovable(behavior)
      manager.unregisterMovable()
    })

    it('does not unregisters a phantom mesh', () => {
      const mesh = CreateBox('box3', {})
      mesh.isPhantom = true
      const behavior = new MoveBehavior()
      mesh.addBehavior(behavior, true)
      expect(manager.isManaging(mesh)).toBe(true)

      mesh.dispose()
      expect(manager.isManaging(mesh)).toBe(true)
    })
  })

  describe('given single mesh', () => {
    let moved
    let targets

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = createsMovable()
      targets = [
        createsTarget(1, new Vector3(3, 0, 0)),
        createsTarget(2, new Vector3(-1, 0, -4.1))
      ]
    })

    describe('start()', () => {
      it('ignores uncontrolled mesh', () => {
        const mesh = CreateBox('box4', {})
        manager.start(mesh, { x: centerX, y: centerY })
        expect(manager.inProgress).toBe(false)
        expectMoveRecorded(moveRecorded)
      })

      it('ignores disabled mesh', () => {
        const mesh = CreateBox('box4', {})
        const behavior = new MoveBehavior()
        mesh.addBehavior(behavior, true)
        behavior.enabled = false

        manager.start(mesh, { x: centerX, y: centerY })
        expect(manager.inProgress).toBe(false)
        expectMoveRecorded(moveRecorded)
      })

      it('elevates moved mesh', () => {
        manager.start(moved, { x: centerX, y: centerY })
        expect(manager.inProgress).toBe(true)
        expectPosition(moved, [1, 1 + manager.elevation, 1])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved.id,
            pos: moved.absolutePosition.asArray(),
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expectMoveRecorded(moveRecorded, moved)
      })
    })

    describe('continue()', () => {
      beforeEach(() => {
        manager.start(moved, { x: centerX, y: centerY })
        actionRecorded.mockReset()
        moveRecorded.mockReset()
      })

      it('updates moved mesh position', () => {
        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207
        manager.continue({ x: centerX + 50, y: centerY + 50 })
        expectPosition(moved, [1 + deltaX, 1 + manager.elevation, 1 + deltaZ])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved.id,
            pos: moved.absolutePosition.asArray(),
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
        const obstacle = CreateBox('obstacle', { size: 2 })
        obstacle.setAbsolutePosition(1, 0.5, 1)
        obstacle.computeWorldMatrix()

        manager.continue({ x: centerX + 20, y: centerY })
        expectPosition(moved, [
          1.8257662057876587,
          getAltitudeOnCollision(moved, obstacle),
          1
        ])
      })

      it('elevates moved mesh above stacked obstacles', () => {
        const obstacle1 = CreateBox('obstacle1', {})
        obstacle1.setAbsolutePosition(1, 0.5, 1)
        obstacle1.computeWorldMatrix()
        const obstacle2 = CreateBox('obstacle2', {})
        obstacle2.setAbsolutePosition(1, 2, 1)
        obstacle2.computeWorldMatrix()
        const obstacle3 = CreateBox('obstacle3', {})
        obstacle3.setAbsolutePosition(1, 3.5, 1)
        obstacle3.computeWorldMatrix()

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
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(manager.getActiveZones()).toHaveLength(0)
        expect(manager.inProgress).toBe(false)
        expectMoveRecorded(moveRecorded)
      })
    })

    describe('stop()', () => {
      beforeEach(() => {
        manager.start(moved, { x: centerX, y: centerY })
        actionRecorded.mockReset()
        moveRecorded.mockReset()
      })

      it('descends moved mesh', async () => {
        await manager.stop()
        expectPosition(moved, [1, getDimensions(moved).height / 2, 1])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved.id,
            pos: moved.absolutePosition.asArray(),
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(manager.getActiveZones()).toHaveLength(0)
        expect(manager.inProgress).toBe(false)
        expect(drops).toHaveLength(0)
        expectMoveRecorded(moveRecorded)
      })

      it('drops moved mesh to active target', async () => {
        const deltaX = 2.050389051437378
        const deltaZ = -0.8877299800515175
        manager.continue({ x: centerX + 50, y: centerY + 20 })
        expect(manager.getActiveZones()).toHaveLength(1)
        expectZoneForMeshes(targets[0].id, [moved])

        await manager.stop()
        expectPosition(moved, [
          1 + deltaX,
          moved.absolutePosition.y,
          1 + deltaZ
        ])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved.id,
            pos: moved.absolutePosition.asArray(),
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
      })

      it('disables other operations', async () => {
        await manager.stop()
        manager.continue()
        await manager.stop()
        expectPosition(moved, [1, getDimensions(moved).height / 2, 1])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved.id,
            pos: moved.absolutePosition.asArray(),
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
    let moved
    let cameraPosition
    const handOverlay = document.createElement('div')

    beforeAll(() => {
      manager.init({ scene })
      handManager.init({ scene, handScene, overlay: handOverlay })
      cameraPosition = camera.position.clone()
    })

    beforeEach(() => {
      moved = createCard(
        { id: 'box', x: 1, y: 1, z: 1, drawable: {}, movable: {} },
        handScene
      )
      camera.setPosition(cameraPosition)
      jest
        .spyOn(window, 'getComputedStyle')
        .mockImplementation(() => ({ height: `${centerY / 2}px` }))
    })

    it('moves according to hand camera', async () => {
      scene.activeCamera.setPosition(new Vector3(10, 0, 0))
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

    it('keeps moving mesh after drawn', () => {
      let event = { x: centerX, y: centerY }
      manager.start(moved, event)
      expect(manager.inProgress).toBe(true)
      expectPosition(moved, [1, 1 + manager.elevation, 1])

      inputManager.onDragObservable.notifyObservers({
        type: 'dragStart',
        mesh: moved,
        event
      })
      const deltaX = 2.029703140258789
      const deltaZ = -2.1969470977783203
      event = { x: centerX + 50, y: centerY + 50 }
      inputManager.onDragObservable.notifyObservers({
        type: 'drag',
        mesh: moved,
        event
      })
      manager.continue(event)

      const mainMoved = scene.getMeshById(moved.id)
      expect(mainMoved).not.toBeNull()
      expectPosition(mainMoved, [deltaX, manager.elevation, deltaZ])
      expect(manager.inProgress).toBe(true)
      expect(drops).toHaveLength(0)

      expect(actionRecorded).toHaveBeenNthCalledWith(
        1,
        {
          meshId: moved.id,
          pos: [1, 1 + manager.elevation, 1],
          fromHand: true
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenNthCalledWith(
        2,
        {
          meshId: moved.id,
          fn: 'draw',
          args: [expect.anything()],
          fromHand: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenNthCalledWith(
        3,
        {
          meshId: moved.id,
          pos: [deltaX, manager.elevation, deltaZ],
          fromHand: false
        },
        expect.anything()
      )
      expect(actionRecorded).toHaveBeenCalledTimes(3)
      expect(manager.getActiveZones()).toHaveLength(0)
      expectMoveRecorded(moveRecorded, moved)
    })

    it('excludes selected meshes from main scene when moving hand mesh', async () => {
      const positions = [new Vector3(0, 5, 0), new Vector3(-3, 0, -3)]
      const meshes = [
        createsMovable('box1', positions[0]),
        createsMovable('box2', positions[1])
      ]
      selectionManager.select(...meshes, moved)

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
    })
  })

  describe('given active selection', () => {
    let moved
    let targets

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = [
        createsMovable(),
        createsMovable('box1', new Vector3(0, 5, 0)),
        createsMovable('box2', new Vector3(-3, 0.5, -3))
      ]
      selectionManager.select(...moved)
      targets = [
        createsTarget(1, new Vector3(3, 0, 0)),
        createsTarget(2, new Vector3(-1, 0, -4.1))
      ]
    })

    describe('start()', () => {
      it('elevates entire selection', () => {
        manager.start(moved[1], { x: centerX, y: centerY })
        expectPosition(moved[0], [1, 1 + manager.elevation, 1])
        expectPosition(moved[1], [0, 5 + manager.elevation, 0])
        expectPosition(moved[2], [-3, 0.5 + manager.elevation, -3])
        expect(actionRecorded).toHaveBeenNthCalledWith(
          1,
          {
            meshId: moved[2].id,
            pos: moved[2].absolutePosition.asArray(),
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: moved[0].id,
            pos: moved[0].absolutePosition.asArray(),
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          3,
          {
            meshId: moved[1].id,
            pos: moved[1].absolutePosition.asArray(),
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(moved.length)
        expect(manager.getActiveZones()).toHaveLength(0)
        expectMoveRecorded(moveRecorded, moved[2], moved[0], moved[1])
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
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: moved[0].id,
            pos: moved[0].absolutePosition.asArray(),
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          3,
          {
            meshId: moved[1].id,
            pos: moved[1].absolutePosition.asArray(),
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

        manager.continue({ x: centerX + 50, y: centerY + 40 })
        expect(manager.getActiveZones()).toHaveLength(1)
        expectZoneForMeshes(targets[1].id, [moved[2]])
      })

      it('elevates entire selection on collision', () => {
        const deltaX = 0.8257662057876587
        const obstacle1 = CreateBox('obstacle1', { size: 2 })
        obstacle1.setAbsolutePosition(1, 0.5, 1)
        obstacle1.computeWorldMatrix()
        const obstacle2 = CreateBox('obstacle2', { size: 2 })
        obstacle2.setAbsolutePosition(-10, 0, -10)
        obstacle2.computeWorldMatrix()

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
        moved[0].computeWorldMatrix()
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
        actionRecorded.mockReset()

        manager.exclude(moved[0], moved[2])

        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207

        manager.continue({ x: centerX + 50, y: centerY + 50 })
        expectPosition(moved[0], [1, 1.5, 1])
        expectPosition(moved[1], [deltaX, 5 + manager.elevation, deltaZ])
        expectPosition(moved[2], [-3, 0.5 + manager.elevation, -3])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved[1].id,
            pos: moved[1].absolutePosition.asArray(),
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expect(manager.getActiveZones()).toHaveLength(0)
      })

      it('ignores unknow meshes', () => {
        selectionManager.clear()
        selectionManager.select(...moved.slice(0, 2))
        manager.start(moved[1], { x: centerX, y: centerY })
        actionRecorded.mockReset()

        manager.exclude(moved[2])

        const deltaX = 2.029703140258789
        const deltaZ = -2.196934700012207

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
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenNthCalledWith(
          2,
          {
            meshId: moved[1].id,
            pos: moved[1].absolutePosition.asArray(),
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(2)
        expect(manager.getActiveZones()).toHaveLength(0)
      })
    })

    describe('stop()', () => {
      beforeEach(() => {
        manager.start(moved[0], { x: centerX, y: centerY })
        actionRecorded.mockReset()
        moveRecorded.mockReset()
      })

      it('drops relevant meshes on their target and move others', async () => {
        const deltaX = 2.050389051437378
        const deltaZ = -0.8877299800515175
        manager.continue({ x: centerX + 50, y: centerY + 20 })
        expect(manager.getActiveZones()).toHaveLength(2)
        expectZoneForMeshes(targets[0].id, [moved[0]])
        expectZoneForMeshes(targets[1].id, [moved[2]])

        await manager.stop()
        expectPosition(moved[0], [
          1 + deltaX,
          moved[0].absolutePosition.y,
          1 + deltaZ
        ])
        expectPosition(moved[1], [2, getDimensions(moved[1]).height / 2, -1])
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
      })
    })
  })

  describe('given parent and active selection', () => {
    let moved

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = [
        createsMovable(),
        createsMovable('box1', new Vector3(0, 5, 0)),
        createsMovable('box2', new Vector3(-3, 0.5, -3))
      ]
      moved[1].setParent(moved[0])
      moved[2].setParent(moved[1])
      selectionManager.select(moved[0], moved[1])
    })

    describe('start()', () => {
      it('elevates unselected children mesh', () => {
        manager.start(moved[1], { x: centerX, y: centerY })
        expectPosition(moved[0], [1, 1 + manager.elevation, 1])
        expectPosition(moved[1], [0, 5 + manager.elevation, 0])
        expectPosition(moved[2], [-3, 0.5 + manager.elevation, -3])
        expect(actionRecorded).toHaveBeenCalledWith(
          {
            meshId: moved[0].id,
            pos: moved[0].absolutePosition.asArray(),
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
            pos: moved[0].absolutePosition.asArray(),
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
    let moved

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = [
        createsMovable(),
        createsMovable('box1', new Vector3(0, 5, 0)),
        createsMovable('box2', new Vector3(-3, 0.5, -3))
      ].map(movable => movable.addBehavior(new StackBehavior(), true))
      moved[0].metadata.push(moved[1].id, true)
      moved[0].metadata.push(moved[2].id, true)
      actionRecorded.mockClear()
      moveRecorded.mockClear()
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
          fromHand: false
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
      beforeEach(() => selectionManager.select(...moved))

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
            fromHand: false
          },
          expect.anything()
        )
        expect(actionRecorded).toHaveBeenCalledTimes(1)
        expectMoveRecorded(moveRecorded, moved[0])
      })
    })
  })

  function createsMovable(
    id = 'box',
    position = new Vector3(1, 1, 1),
    sceneUsed = scene
  ) {
    const movable = CreateBox(id, {}, sceneUsed)
    movable.setAbsolutePosition(position)
    movable.addBehavior(new MoveBehavior(), true)
    movable.computeWorldMatrix()
    controlManager.registerControlable(movable)
    return movable
  }

  function createsTarget(rank = 1, position = new Vector3(0, 0, 0)) {
    const targetable = CreateBox(`targetable-${rank}`, {})
    targetable.isPickable = false
    const behavior = new TargetBehavior()
    behavior.onDropObservable.add(drop => drops.push(drop))
    targetable.addBehavior(behavior, true)

    const target = CreateBox(`target-${rank}`, {})
    target.setAbsolutePosition(position)
    target.computeWorldMatrix()
    behavior.addZone(target, { extent: 0.5 })
    return target
  }

  function expectDroppedEvent(rank, target, moved) {
    expect(drops[rank]?.zone.mesh.id).toEqual(target.id)
    expect(getIds(drops[rank]?.dropped)).toEqual(getIds(moved))
  }
})

function expectZoneForMeshes(targetId, meshes) {
  const zone = manager.getActiveZones().find(({ mesh }) => mesh.id === targetId)
  expect(zone).toBeDefined()
  expect(getIds(targetManager.droppablesByDropZone.get(zone))).toEqual(
    getIds(meshes)
  )
}

function getAltitudeOnCollision(moved, obstacle, offset = 0) {
  return (
    obstacle.getBoundingInfo().boundingBox.maximumWorld.y +
    getDimensions(moved).height * 0.5 +
    offset +
    manager.elevation
  )
}

function getIds(meshes = []) {
  return meshes.map(({ id }) => id)
}
