import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import { configures3dTestEngine, sleep } from '../../test-utils'
import { createTable } from '../../../src/3d'
import {
  controlManager,
  moveManager as manager,
  selectionManager,
  targetManager
} from '../../../src/3d/managers'
import { MoveBehavior, TargetBehavior } from '../../../src/3d/behaviors'
import { getHeight } from '../../../src/3d/utils'

describe('MoveManager', () => {
  let scene
  const centerX = 1024
  const centerY = 512
  const recordSpy = jest.spyOn(controlManager, 'record')
  let drops

  configures3dTestEngine(created => {
    scene = created.scene
  })

  beforeEach(() => {
    jest.resetAllMocks()
    createTable()
    drops = []
    selectionManager.clear()
  })

  it('has initial state', () => {
    expect(manager.inProgress).toBe(false)
    expect(manager.elevation).toBeNull()
  })

  it('can not continue before start', () => {
    expect(manager.continue({ x: 100, y: 100 }))
    expect(manager.inProgress).toBe(false)
  })

  it('can not stop before start', () => {
    expect(manager.stop())
    expect(manager.inProgress).toBe(false)
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
    })
  })

  describe('registerMovable()', () => {
    it('registers a mesh', () => {
      const mesh = BoxBuilder.CreateBox('box3', {})
      mesh.addBehavior(new MoveBehavior(), true)
      expect(manager.isManaging(mesh)).toBe(true)
    })

    it('automatically unregisters a mesh upon disposal', () => {
      const mesh = BoxBuilder.CreateBox('box3', {})
      mesh.addBehavior(new MoveBehavior(), true)
      expect(manager.isManaging(mesh)).toBe(true)

      mesh.dispose()
      expect(manager.isManaging(mesh)).toBe(false)
    })

    it('automatically unregisters a mesh upon behavior detachment', () => {
      const mesh = BoxBuilder.CreateBox('box3', {})
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
  })

  describe('start()', () => {
    let moved

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = createsMovable()
    })

    it('ignores uncontrolled mesh', () => {
      const mesh = BoxBuilder.CreateBox('box4', {})
      manager.start(mesh, { x: centerX, y: centerY })
      expect(manager.inProgress).toBe(false)
    })

    it('ignores disabled mesh', () => {
      const mesh = BoxBuilder.CreateBox('box4', {})
      const behavior = new MoveBehavior()
      mesh.addBehavior(behavior, true)
      behavior.enabled = false

      manager.start(mesh, { x: centerX, y: centerY })
      expect(manager.inProgress).toBe(false)
    })

    it('elevates moved mesh', () => {
      manager.start(moved, { x: centerX, y: centerY })
      expect(manager.inProgress).toBe(true)
      expectPosition(moved, [1, 1 + manager.elevation, 1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        meshId: moved.id,
        pos: moved.absolutePosition.asArray()
      })
    })
  })

  describe('start()', () => {
    let moved

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = [
        createsMovable(),
        createsMovable('box1', new Vector3(0, 5, 0)),
        createsMovable('box2', new Vector3(-3, 0, -3))
      ]
      for (const mesh of moved) {
        selectionManager.select(mesh)
      }
    })

    it('elevates entire selection', () => {
      manager.start(moved[1], { x: centerX, y: centerY })
      expectPosition(moved[0], [1, 1 + manager.elevation, 1])
      expectPosition(moved[1], [0, 5 + manager.elevation, 0])
      expectPosition(moved[2], [-3, manager.elevation, -3])
      expect(recordSpy).toHaveBeenCalledTimes(moved.length)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        meshId: moved[2].id,
        pos: moved[2].absolutePosition.asArray()
      })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        meshId: moved[0].id,
        pos: moved[0].absolutePosition.asArray()
      })
      expect(recordSpy).toHaveBeenNthCalledWith(3, {
        meshId: moved[1].id,
        pos: moved[1].absolutePosition.asArray()
      })
      expect(manager.getActiveZones()).toHaveLength(0)
    })
  })

  describe('continue()', () => {
    let moved
    let targets

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = createsMovable()
      targets = [
        createsTarget(1, new Vector3(3, 0, 0)),
        createsTarget(2, new Vector3(-3, 0, 0))
      ]
      manager.start(moved, { x: centerX, y: centerY })
      recordSpy.mockReset()
    })

    it('updates moved mesh position', () => {
      const deltaX = 2.029703140258789
      const deltaZ = -2.196934700012207
      manager.continue({ x: centerX + 50, y: centerY + 50 })
      expectPosition(moved, [1 + deltaX, 1 + manager.elevation, 1 + deltaZ])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        meshId: moved.id,
        pos: moved.absolutePosition.asArray()
      })
      expect(manager.getActiveZones()).toHaveLength(0)
    })

    it('updates possible targets', () => {
      manager.continue({ x: centerX + 50, y: centerY + 20 })
      expect(manager.getActiveZones()).toHaveLength(1)
      expectZoneForMeshes(targets[0].id, [moved])

      manager.continue({ x: centerX - 100, y: centerY + 20 })
      expect(manager.getActiveZones()).toHaveLength(1)
      expectZoneForMeshes(targets[1].id, [moved])
    })

    it('elevates moved when detecting a collision', () => {
      const obstacle = BoxBuilder.CreateBox('obstacle', { size: 2 })
      obstacle.setAbsolutePosition(1, 0.5, 1)
      obstacle.computeWorldMatrix()

      manager.continue({ x: centerX + 20, y: centerY })
      expectPosition(moved, [
        1.8257662057876587,
        getAltitudeOnCollision(moved, obstacle),
        1
      ])
    })

    it('stops when pointer is leaving table', async () => {
      manager.continue({ x: centerX * 3, y: centerY * 3 })
      await sleep()
      expectPosition(moved, [1, getHeight(moved) / 2, 1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        meshId: moved.id,
        pos: moved.absolutePosition.asArray()
      })
      expect(manager.getActiveZones()).toHaveLength(0)
      expect(manager.inProgress).toBe(false)
    })
  })

  describe('continue()', () => {
    let moved
    let targets

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = [
        createsMovable(),
        createsMovable('box1', new Vector3(0, 5, 0)),
        createsMovable('box2', new Vector3(-3, 0, -3))
      ]
      for (const mesh of moved) {
        selectionManager.select(mesh)
      }
      targets = [
        createsTarget(1, new Vector3(3, 0, 0)),
        createsTarget(2, new Vector3(-1, 0, -4.1))
      ]
      manager.start(moved[0], { x: centerX, y: centerY })
      recordSpy.mockReset()
    })

    it('moves entire selection, ordered by elevation', () => {
      const deltaX = 2.029703140258789
      const deltaZ = -2.196934700012207

      manager.continue({ x: centerX + 50, y: centerY + 50 })
      expectPosition(moved[0], [1 + deltaX, 1 + manager.elevation, 1 + deltaZ])
      expectPosition(moved[1], [deltaX, 5 + manager.elevation, deltaZ])
      expectPosition(moved[2], [-3 + deltaX, manager.elevation, -3 + deltaZ])
      expect(recordSpy).toHaveBeenCalledTimes(moved.length)
      expect(recordSpy).toHaveBeenNthCalledWith(1, {
        meshId: moved[2].id,
        pos: moved[2].absolutePosition.asArray()
      })
      expect(recordSpy).toHaveBeenNthCalledWith(2, {
        meshId: moved[0].id,
        pos: moved[0].absolutePosition.asArray()
      })
      expect(recordSpy).toHaveBeenNthCalledWith(3, {
        meshId: moved[1].id,
        pos: moved[1].absolutePosition.asArray()
      })
      expect(manager.getActiveZones()).toHaveLength(0)
    })

    it('updates target for individual selected meshes', () => {
      manager.continue({ x: centerX + 50, y: centerY + 20 })
      expect(manager.getActiveZones()).toHaveLength(2)
      expectZoneForMeshes(targets[0].id, [moved[0]])
      expectZoneForMeshes(targets[1].id, [moved[2]])

      manager.continue({ x: centerX + 50, y: centerY + 30 })
      expect(manager.getActiveZones()).toHaveLength(1)
      expectZoneForMeshes(targets[1].id, [moved[2]])
    })

    it('elevates entire selection on collision', () => {
      const deltaX = 0.8257662057876587
      const obstacle1 = BoxBuilder.CreateBox('obstacle1', { size: 2 })
      obstacle1.setAbsolutePosition(1, 0.5, 1)
      obstacle1.computeWorldMatrix()
      const obstacle2 = BoxBuilder.CreateBox('obstacle2', { size: 2 })
      obstacle2.setAbsolutePosition(-10, 0, -10)
      obstacle2.computeWorldMatrix()

      manager.continue({ x: centerX + 20, y: centerY })
      expectPosition(moved[0], [
        1 + deltaX,
        getAltitudeOnCollision(moved[0], obstacle1),
        1
      ])
      expectPosition(moved[1], [
        deltaX,
        getAltitudeOnCollision(moved[1], obstacle1),
        0
      ])
      expectPosition(moved[2], [
        -3 + deltaX,
        getAltitudeOnCollision(moved[2], obstacle1),
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
      expectPosition(moved[2], [-3 + deltaX, manager.elevation, -3 + deltaZ])
    })
  })

  describe('stop()', () => {
    let moved
    let target

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = createsMovable()
      target = createsTarget(1, new Vector3(3, 0, 0))
      manager.start(moved, { x: centerX, y: centerY })
      recordSpy.mockReset()
    })

    it('descends moved mesh', async () => {
      await manager.stop()
      expectPosition(moved, [1, getHeight(moved) / 2, 1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        meshId: moved.id,
        pos: moved.absolutePosition.asArray()
      })
      expect(manager.getActiveZones()).toHaveLength(0)
      expect(manager.inProgress).toBe(false)
      expect(drops).toHaveLength(0)
    })

    it('drops moved mesh to active target', async () => {
      const deltaX = 2.050389051437378
      const deltaZ = -0.8877299800515175
      manager.continue({ x: centerX + 50, y: centerY + 20 })
      expect(manager.getActiveZones()).toHaveLength(1)
      expectZoneForMeshes(target.id, [moved])

      await manager.stop()
      expectPosition(moved, [
        1 + deltaX,
        getAltitudeOnDrop(moved, target),
        1 + deltaZ
      ])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        meshId: moved.id,
        pos: moved.absolutePosition.asArray()
      })
      expect(manager.getActiveZones()).toHaveLength(0)
      expect(manager.inProgress).toBe(false)
      expect(drops).toHaveLength(1)
      expect(drops[0]).toEqual({
        zone: expect.objectContaining({ mesh: target }),
        dropped: [moved]
      })
    })

    it('disables other operations', async () => {
      await manager.stop()
      manager.continue()
      await manager.stop()
      expectPosition(moved, [1, getHeight(moved) / 2, 1])
      expect(recordSpy).toHaveBeenCalledTimes(1)
      expect(recordSpy).toHaveBeenCalledWith({
        meshId: moved.id,
        pos: moved.absolutePosition.asArray()
      })
      expect(manager.inProgress).toBe(false)
      expect(drops).toHaveLength(0)
      expect(manager.getActiveZones()).toHaveLength(0)
    })
  })

  describe('stop()', () => {
    let moved
    let targets

    beforeAll(() => manager.init({ scene }))

    beforeEach(() => {
      moved = [
        createsMovable(),
        createsMovable('box1', new Vector3(0, 5, 0)),
        createsMovable('box2', new Vector3(-3, 1, -3))
      ]
      for (const mesh of moved) {
        selectionManager.select(mesh)
      }
      targets = [
        createsTarget(1, new Vector3(3, 0, 0)),
        createsTarget(2, new Vector3(-1, 0, -4.1))
      ]
      manager.start(moved[0], { x: centerX, y: centerY })
      recordSpy.mockReset()
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
        getAltitudeOnDrop(moved[0], targets[0]),
        1 + deltaZ
      ])
      expectPosition(moved[1], [2, getHeight(moved[1]) / 2, -1])
      expectPosition(moved[2], [
        -3 + deltaX,
        getAltitudeOnDrop(moved[2], targets[1]),
        -3 + deltaZ
      ])
      expect(manager.getActiveZones()).toHaveLength(0)
      expect(manager.inProgress).toBe(false)
      expect(drops).toHaveLength(2)
      expect(drops[0]).toEqual({
        zone: expect.objectContaining({ mesh: targets[0] }),
        dropped: [moved[0]]
      })
      expect(drops[1]).toEqual({
        zone: expect.objectContaining({ mesh: targets[1] }),
        dropped: [moved[2]]
      })
    })
  })

  function createsMovable(id = 'box', position = new Vector3(1, 1, 1)) {
    const movable = BoxBuilder.CreateBox(id, {})
    movable.setAbsolutePosition(position)
    movable.addBehavior(new MoveBehavior(), true)
    movable.computeWorldMatrix()
    return movable
  }

  function createsTarget(rank = 1, position = new Vector3(0, 0, 0)) {
    const targetable = BoxBuilder.CreateBox(`targetable-${rank}`, {})
    targetable.isPickable = false
    const behavior = new TargetBehavior()
    behavior.onDropObservable.add(drop => drops.push(drop))
    targetable.addBehavior(behavior, true)

    const target = BoxBuilder.CreateBox(`target-${rank}`, {})
    target.setAbsolutePosition(position)
    target.computeWorldMatrix()
    behavior.addZone(target, 0.5)
    return target
  }
})

function expectZoneForMeshes(targetId, meshes) {
  const zone = manager.getActiveZones().find(({ mesh }) => mesh.id === targetId)
  expect(zone).toBeDefined()
  expect(targetManager.droppablesByDropZone.get(zone)).toEqual(meshes)
}

function expectPosition(mesh, [x, y, z]) {
  expect(mesh.absolutePosition.x).toBeCloseTo(x)
  expect(mesh.absolutePosition.y).toBeCloseTo(y)
  expect(mesh.absolutePosition.z).toBeCloseTo(z)
}

function getAltitudeOnCollision(moved, obstacle) {
  return (
    moved.getBoundingInfo().boundingBox.minimumWorld.y -
    getHeight(moved) * 2 +
    obstacle.getBoundingInfo().boundingBox.maximumWorld.y
  )
}

function getAltitudeOnDrop(moved, target) {
  return (
    target.getBoundingInfo().boundingBox.maximumWorld.y + getHeight(moved) * 2
  )
}
