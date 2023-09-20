// @ts-check
/**
 * @typedef {import('@babylonjs/core').Mesh} Mesh
 */

import { faker } from '@faker-js/faker'
import { TargetBehavior, TargetBehaviorName } from '@src/3d/behaviors'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { configures3dTestEngine, createBox } from '../../test-utils'

describe('TargetBehavior', () => {
  /** @type {import('@src/3d/managers').Managers} */
  let managers

  configures3dTestEngine(created => (managers = created.managers))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has initial state', () => {
    const behavior = new TargetBehavior({}, managers)
    const mesh = createBox('box', {})

    expect(behavior.name).toEqual(TargetBehaviorName)
    expect(behavior.zones).toEqual([])
    expect(behavior.mesh).toBeNull()

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('adds zones', () => {
    const behavior = new TargetBehavior({}, managers)
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

    const mesh2 = createBox('box2', {})
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
    const playerId = faker.string.uuid()
    const id = `${playerId}.drop-zone.${meshId}`
    expect(managers.indicator.isManaging({ id })).toBe(false)
    const behavior = new TargetBehavior({}, managers)
    const mesh = createBox(meshId, {})
    const zone = behavior.addZone(mesh, { playerId, extent: 1 })
    expect(behavior.zones).toEqual([zone])
    expect(zone).toEqual(
      expect.objectContaining({ mesh, enabled: true, priority: 0, playerId })
    )
    expect(managers.indicator.isManaging({ id })).toBe(true)
    behavior.removeZone(zone)
    expect(managers.indicator.isManaging({ id })).toBe(false)
  })

  it('removes added zone and disposes their mesh', () => {
    const behavior = new TargetBehavior({}, managers)
    const mesh = createBox('box', {})
    const zone = behavior.addZone(mesh, { extent: 1.2 })
    expect(behavior.zones).toEqual([zone])

    behavior.removeZone(zone)
    expect(behavior.zones).toEqual([])
    expect(mesh.isDisposed()).toBe(true)
  })

  it('can not remove random zone', () => {
    const behavior = new TargetBehavior({}, managers)
    const mesh = createBox('box', {})

    behavior.removeZone({
      mesh,
      enabled: true,
      extent: 1,
      priority: 0,
      ignoreParts: true,
      targetable: behavior
    })
    expect(behavior.zones).toEqual([])
  })

  describe('given attached to a mesh', () => {
    /** @type {Mesh} */
    let mesh
    /** @type {TargetBehavior} */
    let behavior

    beforeEach(() => {
      behavior = new TargetBehavior({}, managers)
      mesh = createBox('box', {})
      mesh.addBehavior(behavior, true)
    })

    it('registers to the target manager', () => {
      expect(behavior.mesh).toEqual(mesh)
      expect(managers.target.isManaging(mesh)).toBe(true)
    })

    it('unregisteres from manager and removes zones upon detaching', () => {
      const meshId = 'box1'
      const playerId = faker.string.uuid()
      const id = `${playerId}.drop-zone.${meshId}`
      const mesh1 = createBox(meshId, {})
      behavior.addZone(mesh1, { extent: 1.2, playerId })
      const mesh2 = createBox('box2', {})
      behavior.addZone(mesh2, {
        extent: 2,
        kinds: ['box', 'card'],
        enabled: false
      })
      expect(managers.indicator.isManaging({ id })).toBe(true)

      mesh.dispose()
      expect(behavior.mesh).toBeNull()
      expect(mesh.isDisposed()).toBe(true)
      expect(mesh1.isDisposed()).toBe(true)
      expect(mesh2.isDisposed()).toBe(true)
      expect(behavior.zones).toEqual([])
      expect(managers.indicator.isManaging({ id })).toBe(false)
    })
  })
})
