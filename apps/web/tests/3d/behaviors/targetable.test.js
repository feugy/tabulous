import { BoxBuilder } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import faker from 'faker'
import { configures3dTestEngine } from '../../test-utils'
import { TargetBehavior, TargetBehaviorName } from '../../../src/3d/behaviors'
import { targetManager } from '../../../src/3d/managers'

describe('TargetBehavior', () => {
  configures3dTestEngine()

  // const recordSpy = jest.spyOn(controlManager, 'record')

  beforeEach(jest.resetAllMocks)

  it('has initial state', () => {
    const state = {
      isFlipped: faker.datatype.boolean(),
      duration: faker.datatype.number()
    }
    const behavior = new TargetBehavior(state)
    const mesh = BoxBuilder.CreateBox('box', {})

    expect(behavior.name).toEqual(TargetBehaviorName)
    expect(behavior.zones).toEqual([])
    expect(behavior.mesh).toBeNull()

    mesh.addBehavior(behavior, true)
    expect(behavior.mesh).toEqual(mesh)
  })

  it('adds zones', () => {
    const behavior = new TargetBehavior()
    const mesh1 = BoxBuilder.CreateBox('box1', {})
    const zone1 = behavior.addZone(mesh1, 1.2)
    expect(behavior.zones).toEqual([zone1])
    expect(zone1).toEqual(
      expect.objectContaining({
        mesh: mesh1,
        extent: 1.2,
        enabled: true
      })
    )

    const mesh2 = BoxBuilder.CreateBox('box1', {})
    const zone2 = behavior.addZone(mesh2, 2, ['box', 'card'], false)
    expect(behavior.zones).toEqual([zone1, zone2])
    expect(zone2).toEqual(
      expect.objectContaining({
        mesh: mesh2,
        extent: 2,
        kinds: ['box', 'card'],
        enabled: false
      })
    )
    expect(mesh1.isDisposed()).toBe(false)
    expect(mesh1.isPickable).toBe(false)
    expect(mesh1.visibility).toBe(0)
    expect(mesh2.isDisposed()).toBe(false)
    expect(mesh2.isPickable).toBe(false)
    expect(mesh2.visibility).toBe(0)
  })

  it('removes added zone and disposes their mesh', () => {
    const behavior = new TargetBehavior()
    const mesh = BoxBuilder.CreateBox('box', {})
    const zone = behavior.addZone(mesh, 1.2)
    expect(behavior.zones).toEqual([zone])

    behavior.removeZone(zone)
    expect(behavior.zones).toEqual([])
    expect(mesh.isDisposed()).toBe(true)
  })

  it('can not remove random zone', () => {
    const behavior = new TargetBehavior()
    const mesh = BoxBuilder.CreateBox('box', {})

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
      mesh = BoxBuilder.CreateBox('box', {})
      mesh.addBehavior(behavior, true)
    })

    it('registers to the target manager', () => {
      expect(behavior.mesh).toEqual(mesh)
      expect(targetManager.isManaging(mesh)).toBe(true)
    })

    it('unregisteres from manager and removes zones upon detaching', () => {
      const mesh1 = BoxBuilder.CreateBox('box1', {})
      behavior.addZone(mesh1, 1.2)
      const mesh2 = BoxBuilder.CreateBox('box1', {})
      behavior.addZone(mesh2, 2, ['box', 'card'], false)

      mesh.dispose()
      expect(behavior.mesh).toBeNull()
      expect(mesh.isDisposed()).toBe(true)
      expect(mesh1.isDisposed()).toBe(true)
      expect(mesh2.isDisposed()).toBe(true)
      expect(behavior.zones).toEqual([])
    })
  })
})
