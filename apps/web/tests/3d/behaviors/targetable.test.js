import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { faker } from '@faker-js/faker'
import { configures3dTestEngine } from '../../test-utils'
import { TargetBehavior, TargetBehaviorName } from '../../../src/3d/behaviors'
import { indicatorManager, targetManager } from '../../../src/3d/managers'

describe('TargetBehavior', () => {
  configures3dTestEngine()

  beforeEach(vi.resetAllMocks)

  it('has initial state', () => {
    const state = {
      isFlipped: faker.datatype.boolean(),
      duration: faker.datatype.number()
    }
    const behavior = new TargetBehavior(state)
    const mesh = CreateBox('box', {})

    expect(behavior.name).toEqual(TargetBehaviorName)
    expect(behavior.zones).toEqual([])
    expect(behavior.mesh).toBeNull()

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('adds zones', () => {
    const behavior = new TargetBehavior()
    const mesh1 = CreateBox('box1', {})
    const zone1 = behavior.addZone(mesh1, { extent: 1.2 })
    expect(behavior.zones).toEqual([zone1])
    expectZone(zone1, { mesh: mesh1, extent: 1.2, enabled: true, priority: 0 })

    const mesh2 = CreateBox('box1', {})
    const zone2 = behavior.addZone(mesh2, {
      extent: 2,
      kinds: ['box', 'card'],
      enabled: false,
      priority: 10
    })
    expect(behavior.zones).toEqual([zone1, zone2])
    expectZone(zone2, {
      mesh: mesh2,
      extent: 2,
      kinds: ['box', 'card'],
      enabled: false,
      priority: 10
    })
    expect(mesh1.isDisposed()).toBe(false)
    expect(mesh1.isPickable).toBe(false)
    expect(mesh1.visibility).toBe(0)
    expect(mesh2.isDisposed()).toBe(false)
    expect(mesh2.isPickable).toBe(false)
    expect(mesh2.visibility).toBe(0)
  })

  it('registers indicator for player drop zone', () => {
    const meshId = 'box1'
    const playerId = faker.datatype.uuid()
    const id = `${playerId}.drop-zone.${meshId}`
    expect(indicatorManager.isManaging({ id })).toBe(false)
    const behavior = new TargetBehavior()
    const mesh = CreateBox(meshId, {})
    const zone = behavior.addZone(mesh, { playerId })
    expect(behavior.zones).toEqual([zone])
    expectZone(zone, { mesh, enabled: true, priority: 0, playerId })
    expect(indicatorManager.isManaging({ id })).toBe(true)
    behavior.removeZone(zone)
    expect(indicatorManager.isManaging({ id })).toBe(false)
  })

  it('removes added zone and disposes their mesh', () => {
    const behavior = new TargetBehavior()
    const mesh = CreateBox('box', {})
    const zone = behavior.addZone(mesh, { extent: 1.2 })
    expect(behavior.zones).toEqual([zone])

    behavior.removeZone(zone)
    expect(behavior.zones).toEqual([])
    expect(mesh.isDisposed()).toBe(true)
  })

  it('can not remove random zone', () => {
    const behavior = new TargetBehavior()
    const mesh = CreateBox('box', {})

    behavior.removeZone({
      mesh,
      enabled: true,
      extent: 1,
      targetable: behavior
    })
    expect(behavior.zones).toEqual([])
  })

  describe('given attached to a mesh', () => {
    let mesh
    let behavior

    beforeEach(() => {
      behavior = new TargetBehavior()
      mesh = CreateBox('box', {})
      mesh.addBehavior(behavior, true)
    })

    it('registers to the target manager', () => {
      expect(behavior.mesh).toEqual(mesh)
      expect(targetManager.isManaging(mesh)).toBe(true)
    })

    it('unregisteres from manager and removes zones upon detaching', () => {
      const meshId = 'box1'
      const playerId = faker.datatype.uuid()
      const id = `${playerId}.drop-zone.${meshId}`
      const mesh1 = CreateBox(meshId, {})
      behavior.addZone(mesh1, { extent: 1.2, playerId })
      const mesh2 = CreateBox('box1', {})
      behavior.addZone(mesh2, {
        extent: 2,
        kinds: ['box', 'card'],
        enabled: false
      })
      expect(indicatorManager.isManaging({ id })).toBe(true)

      mesh.dispose()
      expect(behavior.mesh).toBeNull()
      expect(mesh.isDisposed()).toBe(true)
      expect(mesh1.isDisposed()).toBe(true)
      expect(mesh2.isDisposed()).toBe(true)
      expect(behavior.zones).toEqual([])
      expect(indicatorManager.isManaging({ id })).toBe(false)
    })
  })
})

function expectZone(zone, { mesh, extent, enabled, kinds, priority }) {
  expect(zone.extent).toEqual(extent)
  expect(zone.enabled).toEqual(enabled)
  expect(zone.kinds).toEqual(kinds)
  expect(zone.priority).toEqual(priority)
  expect(zone.mesh?.id).toEqual(mesh?.id)
}
