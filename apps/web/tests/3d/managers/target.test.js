import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { configures3dTestEngine } from '../../test-utils'
import {
  targetManager as manager,
  selectionManager
} from '../../../src/3d/managers'
import { TargetBehavior } from '../../../src/3d/behaviors'

describe('TargetManager', () => {
  let drops
  let scene
  let handScene

  configures3dTestEngine(created => {
    scene = created.scene
    handScene = created.handScene
  })

  beforeEach(() => {
    jest.resetAllMocks()
    drops = []
  })

  it('has initial state', () => {
    expect(manager.scene).toBeNull()
  })

  describe('init()', () => {
    it('sets scene', () => {
      manager.init({ scene })
      expect(manager.scene).toEqual(scene)
    })
  })

  describe('given an initialized manager', () => {
    beforeAll(() => manager.init({ scene }))

    describe('registerTargetable()', () => {
      it('registers a mesh', () => {
        const mesh = CreateBox('box3', {})
        mesh.addBehavior(new TargetBehavior(), true)
        expect(manager.isManaging(mesh)).toBe(true)
      })

      it('automatically unregisters a mesh upon disposal', () => {
        const mesh = CreateBox('box3', {})
        mesh.addBehavior(new TargetBehavior(), true)
        expect(manager.isManaging(mesh)).toBe(true)

        mesh.dispose()
        expect(manager.isManaging(mesh)).toBe(false)
      })

      it('automatically unregisters a mesh upon behavior detachment', () => {
        const mesh = CreateBox('box3', {})
        const behavior = new TargetBehavior()
        mesh.addBehavior(behavior, true)
        expect(manager.isManaging(mesh)).toBe(true)

        behavior.detach()
        expect(manager.isManaging(mesh)).toBe(false)
      })

      it('handles invalid behavior', () => {
        const behavior = new TargetBehavior()
        manager.registerTargetable(behavior)
        manager.registerTargetable()
      })
    })

    describe('unregisterTargetable()', () => {
      it('handles invalid behavior', () => {
        const behavior = new TargetBehavior()
        manager.unregisterTargetable(behavior)
        manager.unregisterTargetable()
      })
    })

    describe('findDropZone()', () => {
      let zone1
      let zone2

      beforeEach(() => {
        zone1 = createsTargetZone('target1', new Vector3(5, 0, 5))
        zone2 = createsTargetZone('target2', new Vector3(-5, 0, -5))
      })

      it('returns nothing if mesh is not above any target', () => {
        expect(manager.findDropZone(CreateBox('box', {}))).not.toBeDefined()
      })

      it('returns targets below mesh', () => {
        const mesh = CreateBox('box', {})
        mesh.setAbsolutePosition(zone1.mesh.absolutePosition)
        mesh.computeWorldMatrix()

        expectActiveZone(manager.findDropZone(mesh), zone1)
      })

      it('ignores targets with kinds below kind-less mesh', () => {
        zone1.kinds = ['card']
        const mesh = CreateBox('box', {})
        mesh.setAbsolutePosition(zone1.mesh.absolutePosition)
        mesh.computeWorldMatrix()

        expect(manager.findDropZone(mesh)).not.toBeDefined()
      })

      it('ignores disabled targets', () => {
        zone1.enabled = false
        const mesh = CreateBox('box', {})
        mesh.setAbsolutePosition(zone1.mesh.absolutePosition)
        mesh.computeWorldMatrix()

        expect(manager.findDropZone(mesh)).not.toBeDefined()
      })

      it('ignores target part of the current selection', () => {
        selectionManager.select(zone1.targetable.mesh)
        const mesh = CreateBox('box', {})
        mesh.setAbsolutePosition(zone1.mesh.absolutePosition)
        mesh.computeWorldMatrix()

        expect(manager.findDropZone(mesh)).not.toBeDefined()
      })

      it('ignores targets when not in main scene', () => {
        const zone3 = createsTargetZone(
          'target1',
          new Vector3(10, 0, 10),
          undefined,
          handScene
        )
        const mesh = CreateBox('box', {}, handScene)
        mesh.setAbsolutePosition(zone3.mesh.absolutePosition)
        mesh.computeWorldMatrix()

        expect(manager.findDropZone(mesh)).not.toBeDefined()
      })

      it('returns kind-less targets below mesh with kind', () => {
        const mesh = CreateBox('box', {})
        mesh.setAbsolutePosition(zone1.mesh.absolutePosition)
        mesh.computeWorldMatrix()

        expectActiveZone(manager.findDropZone(mesh, 'box'), zone1)
      })

      it('returns targets below mesh with matching kind', () => {
        zone1.kinds = ['card', 'box']
        const mesh = CreateBox('box', {})
        mesh.setAbsolutePosition(zone2.mesh.absolutePosition)
        mesh.computeWorldMatrix()

        expectActiveZone(manager.findDropZone(mesh, 'box'), zone2)
      })

      it('returns highest target below mesh regardless of priorities', () => {
        createsTargetZone('target3', new Vector3(0, 0, 0), 10)
        const zone4 = createsTargetZone('target4', new Vector3(0, 1, 0))
        createsTargetZone('target5', new Vector3(0, 0.5, 0))

        const mesh = CreateBox('box', {})
        mesh.setAbsolutePosition(new Vector3(0, 5, 0))
        mesh.computeWorldMatrix()

        expectActiveZone(manager.findDropZone(mesh, 'box'), zone4)
      })

      it('returns highest priority target below mesh', () => {
        createsTargetZone('target3', new Vector3(0, 0, 0))
        const zone4 = createsTargetZone('target4', new Vector3(0, 0, 0), 2)
        createsTargetZone('target5', new Vector3(0, 0, 0), 1)

        const mesh = CreateBox('box', {})
        mesh.setAbsolutePosition(new Vector3(0, 5, 0))
        mesh.computeWorldMatrix()

        expectActiveZone(manager.findDropZone(mesh, 'box'), zone4)
      })

      describe('clear()', () => {
        beforeEach(() => {
          const mesh = CreateBox('box', {})
          mesh.setAbsolutePosition(zone1.mesh.absolutePosition)
          mesh.computeWorldMatrix()
          manager.findDropZone(mesh, 'box')
        })

        it('clears an active zone', () => {
          expectVisibility(zone1, true)
          manager.clear(zone1)
          expectVisibility(zone1, false)
          expect(manager.dropOn(zone1)).toEqual([])
        })

        it('ignores unactive zone', () => {
          expectVisibility(zone2, false)
          manager.clear(zone2)
          expectVisibility(zone2, false)
          expect(manager.dropOn(zone2)).toEqual([])
        })

        it('handles invalid zones', () => {
          manager.clear()
          manager.clear(null)
          manager.clear({})
          expectVisibility(zone1, true)
          expectVisibility(zone2, false)
        })
      })

      describe('dropOn()', () => {
        let meshes = ['box1', 'box2']
        beforeEach(() => {
          meshes = meshes.map(id => {
            const mesh = CreateBox(id, {})
            mesh.setAbsolutePosition(zone1.mesh.absolutePosition)
            mesh.computeWorldMatrix()
            manager.findDropZone(mesh, 'box')
            return mesh
          })
        })

        it('ignores unactive zone', () => {
          expect(manager.dropOn(zone2)).toEqual([])
        })

        it('drops meshes on zone and clear it', () => {
          expectVisibility(zone1, true)
          expect(manager.dropOn(zone1)).toEqual(meshes)
          expectVisibility(zone1, false)
        })
      })
    })

    describe('canAccept()', () => {
      it('returns false without a zone', () => {
        expect(manager.canAccept()).toBe(false)
      })

      describe('given a kindless zone', () => {
        let zone

        beforeEach(() => {
          zone = { enabled: true }
        })

        it('returns true without kind', () => {
          expect(manager.canAccept(zone)).toBe(true)
        })

        it('returns true with kind', () => {
          expect(manager.canAccept(zone, 'die')).toBe(true)
        })

        it('returns false when disabled', () => {
          zone.enabled = false
          expect(manager.canAccept(zone)).toBe(false)
        })
      })

      describe('given a zone with kind', () => {
        let zone

        beforeEach(() => {
          zone = { enabled: true, kinds: ['card', 'token'] }
        })

        it('returns false without kind', () => {
          expect(manager.canAccept(zone)).toBe(false)
        })

        it('returns false with unexpected kind', () => {
          expect(manager.canAccept(zone, 'die')).toBe(false)
        })

        it('returns true with expected kind', () => {
          expect(manager.canAccept(zone, 'token')).toBe(true)
        })

        it('returns false when disabled', () => {
          zone.enabled = false
          expect(manager.canAccept(zone, 'token')).toBe(false)
        })
      })
    })
  })

  function createsTargetZone(
    id,
    position = new Vector3(0, 0, 0),
    priority = undefined,
    usedScene = scene
  ) {
    const targetable = CreateBox(`targetable-${id}`, {}, usedScene)
    targetable.isPickable = false
    const behavior = new TargetBehavior()
    behavior.onDropObservable.add(drop => drops.push(drop))
    targetable.addBehavior(behavior, true)

    const target = CreateBox(id, {}, usedScene)
    target.setAbsolutePosition(position)
    target.computeWorldMatrix()
    return behavior.addZone(target, { extent: 0.5, priority })
  }

  function expectActiveZone(actual, expected) {
    expect(actual.mesh.id).toEqual(expected.mesh.id)
    expectVisibility(actual, true)
  }

  function expectVisibility(zone, isVisible) {
    expect(zone.mesh.visibility).toEqual(isVisible ? 0.1 : 0)
  }
})
