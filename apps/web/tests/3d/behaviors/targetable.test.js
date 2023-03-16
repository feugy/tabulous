import { faker } from '@faker-js/faker'
import { TargetBehavior, TargetBehaviorName } from '@src/3d/behaviors'
import { indicatorManager, targetManager } from '@src/3d/managers'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { configures3dTestEngine, createBox } from '../../test-utils'

describe('TargetBehavior', () => {
  configures3dTestEngine()

  beforeEach(vi.resetAllMocks)

  it('has initial state', () => {
    const state = {
      isFlipped: faker.datatype.boolean(),
      duration: faker.datatype.number(),
      ignoreParts: faker.datatype.boolean()
    }
    const behavior = new TargetBehavior(state)
    const mesh = createBox('box', {})

    expect(behavior.name).toEqual(TargetBehaviorName)
    expect(behavior.zones).toEqual([])
    expect(behavior.mesh).toBeNull()

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('adds zones', () => {
    const behavior = new TargetBehavior()
    const mesh1 = createBox('box1', {})
    const zone1 = behavior.addZone(mesh1, { extent: 1.2 })
    expect(behavior.zones).toEqual([zone1])
    expect(zone1).toEqual(
      expect.objectContaining({
        mesh: mesh1,
        extent: 1.2,
        enabled: true,
        priority: 0,
        ignoreParts: false
      })
    )

    const mesh2 = createBox('box1', {})
    const zone2 = behavior.addZone(mesh2, {
      extent: 2,
      kinds: ['box', 'card'],
      enabled: false,
      priority: 10,
      ignoreParts: true
    })
    expect(behavior.zones).toEqual([zone1, zone2])
    expect(zone2).toEqual(
      expect.objectContaining({
        mesh: mesh2,
        extent: 2,
        kinds: ['box', 'card'],
        enabled: false,
        priority: 10,
        ignoreParts: true
      })
    )
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
    const mesh = createBox(meshId, {})
    const zone = behavior.addZone(mesh, { playerId })
    expect(behavior.zones).toEqual([zone])
    expect(zone).toEqual(
      expect.objectContaining({ mesh, enabled: true, priority: 0, playerId })
    )
    expect(indicatorManager.isManaging({ id })).toBe(true)
    behavior.removeZone(zone)
    expect(indicatorManager.isManaging({ id })).toBe(false)
  })

  it('removes added zone and disposes their mesh', () => {
    const behavior = new TargetBehavior()
    const mesh = createBox('box', {})
    const zone = behavior.addZone(mesh, { extent: 1.2 })
    expect(behavior.zones).toEqual([zone])

    behavior.removeZone(zone)
    expect(behavior.zones).toEqual([])
    expect(mesh.isDisposed()).toBe(true)
  })

  it('can not remove random zone', () => {
    const behavior = new TargetBehavior()
    const mesh = createBox('box', {})

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
      mesh = createBox('box', {})
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
      const mesh1 = createBox(meshId, {})
      behavior.addZone(mesh1, { extent: 1.2, playerId })
      const mesh2 = createBox('box1', {})
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
